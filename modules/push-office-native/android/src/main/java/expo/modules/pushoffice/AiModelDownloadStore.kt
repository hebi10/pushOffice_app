package expo.modules.pushoffice

import android.app.DownloadManager
import android.app.ActivityManager
import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.os.SystemClock
import android.system.Os
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/** App-scoped downloads, source SHA256 checks, opt-in install and deletion. */
internal object AiModelDownloadStore {
  private const val PREF = "push_office_ai_models"
  private const val SELECTED = "selected"
  private val operations = Mutex()
  private val statusCache = AiModelStatusCache()

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
  private fun directory(ctx: Context): File {
    val root = ctx.getExternalFilesDir(null)
      ?: throw IllegalStateException("모델을 보관할 앱 저장 공간이 없습니다.")
    return File(root, "ai_models").apply { require(isDirectory || mkdirs()) { "모델 저장 폴더를 만들지 못했습니다." } }
  }
  private fun target(ctx: Context, id: String) = File(directory(ctx), id + ".litertlm")
  private fun partial(ctx: Context, id: String) = File(directory(ctx), id + ".part")
  private fun expectedSize(ctx: Context, id: String) = prefs(ctx).getLong(id + "_bytes", 0)
  private fun expectedSha(ctx: Context, id: String) = prefs(ctx).getString(id + "_sha", null).orEmpty()
  private fun downloadId(ctx: Context, id: String) = prefs(ctx).getLong(id + "_download", 0)
  private fun manager(ctx: Context) = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  private fun available(ctx: Context, model: AiModelDefinition): Boolean {
    val file = target(ctx, model.id)
    val expected = expectedSize(ctx, model.id)
    val sha = expectedSha(ctx, model.id)
    return !prefs(ctx).getBoolean(model.id + "_corrupt", false) &&
      file.isFile && expected > 0 && file.length() == expected &&
      sha.matches(Regex("[a-f0-9]{64}")) &&
      (model.sha256 == null || model.sha256 == sha)
  }

  fun installedFile(ctx: Context, model: AiModelDefinition): File? =
    if (model.file != null && available(ctx,model)) target(ctx, model.id) else null

  private fun stamp(file: File, sha: String): ModelFileStamp? = try {
    val st = Os.stat(file.absolutePath)
    ModelFileStamp(file.absolutePath, st.st_size, file.lastModified(),
      st.st_dev, st.st_ino, st.st_ctime, sha)
  } catch (_: Exception) { null }

  private suspend fun fullMatch(file: File, size: Long, sha: String): Boolean {
    val coroutine = currentCoroutineContext()
    return AiModelIntegrity.matches(file, size, sha) { coroutine.ensureActive() }
  }

  /** Caller owns operations. Cached stamps are ONLY used to render a list, never for execution. */
  private suspend fun verifyLocked(ctx: Context, model: AiModelDefinition, listOnly: Boolean = false): File? {
    if (model.file == null) return null
    val file = target(ctx, model.id)
    if (!file.exists()) {
      statusCache.invalidate(model.id)
      return null
    }
    val size = expectedSize(ctx, model.id)
    val sha = expectedSha(ctx, model.id)
    val before = stamp(file, sha)
    if (file.isFile && available(ctx, model) && before != null) {
      if (listOnly && statusCache.fresh(model.id, before, SystemClock.elapsedRealtime())) return file
      if (fullMatch(file, size, sha) && stamp(file, sha) == before) {
        statusCache.record(model.id, before, SystemClock.elapsedRealtime())
        return file
      }
    }
    statusCache.invalidate(model.id)
    prefs(ctx).edit().putBoolean(model.id + "_corrupt", true).apply()
    return null
  }

  /** Full verification before every explicit verify, selection and inference. */
  suspend fun verifiedInstalledFile(ctx: Context, model: AiModelDefinition): File? =
    operations.withLock { withContext(Dispatchers.IO) { verifyLocked(ctx, model) } }

  /** Prevent delete, replace or finalization while the engine has the verified file open. */
  suspend fun <T> withVerifiedInstalledFile(ctx: Context, model: AiModelDefinition,
    action: suspend (File, Long) -> T): T = operations.withLock {
    withContext(Dispatchers.IO) {
      val started = SystemClock.elapsedRealtime()
      val file = verifyLocked(ctx, model)
        ?: throw IllegalStateException("모델 다운로드 또는 무결성 확인이 필요합니다.")
      action(file, SystemClock.elapsedRealtime() - started)
    }
  }

  fun memoryCapacity(ctx: Context): AiDeviceCapacity {
    val memory = ActivityManager.MemoryInfo()
    (ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
    return AiDeviceCapacity(memory.availMem, memory.totalMem, memory.lowMemory, -1L)
  }
  private fun capacity(ctx: Context): AiDeviceCapacity {
    val storage = runCatching { StatFs(directory(ctx).path).availableBytes }.getOrDefault(-1L)
    return memoryCapacity(ctx).copy(freeStorageBytes = storage)
  }

  /** Performs an explicit full SHA256 check, useful after a device reboot or storage issue. */
  suspend fun verify(ctx: Context, id: String): Map<String, Any> {
    val model = AiModelCatalog.get(id)
    require(model.file != null) { "Gemini Nano 모델 파일은 Android AICore에서 관리합니다." }
    return if (verifiedInstalledFile(ctx, model) != null)
      mapOf("state" to "installed", "verified" to true, "message" to "모델 파일 전체 SHA-256 검증이 통과했습니다.")
    else mapOf("state" to "error", "verified" to false,
      "message" to "파일 무결성을 확인하지 못했습니다. 모델을 다시 다운로드해 주세요.")
  }

  fun selected(ctx: Context): String {
    val id = prefs(ctx).getString(SELECTED, "gemini-nano") ?: "gemini-nano"
    if (id == "gemini-nano") return id
    val model = AiModelCatalog.models.firstOrNull { it.id == id } ?: return "gemini-nano"
    return if (runCatching { installedFile(ctx,model) != null }.getOrDefault(false)) id else "gemini-nano"
  }

  private data class RemoteModel(val size: Long, val sha: String)

  /** Only the official approved Hugging Face repository can supply a checksum. */
  private suspend fun remoteMetadata(model: AiModelDefinition): RemoteModel = withContext(Dispatchers.IO) {
    val url = URL(requireNotNull(model.downloadUrl))
    require(url.protocol == "https" && url.host == "huggingface.co") { "허용하지 않은 모델 제공 주소입니다." }
    val conn = (url.openConnection() as HttpsURLConnection).apply {
      requestMethod = "HEAD"
      instanceFollowRedirects = false
      connectTimeout = 15000
      readTimeout = 15000
      setRequestProperty("Accept", "application/octet-stream")
    }
    try {
      require(conn.responseCode in 200..399) { "모델 제공 서버에 연결하지 못했습니다." }
      val rawHash = (conn.getHeaderField("X-Linked-Etag") ?: conn.getHeaderField("ETag") ?: "")
        .trim().trim('"').lowercase()
      require(rawHash.matches(Regex("[a-f0-9]{64}"))) {
        "모델 제공 서버에서 파일 무결성 정보를 확인하지 못했습니다."
      }
      val size = (conn.getHeaderField("X-Linked-Size") ?: conn.getHeaderField("Content-Length"))
        ?.toLongOrNull() ?: 0L
      require(size >= 100_000_000L && size <= 4_500_000_000L &&
        size >= model.approximateMb * 600_000L && size <= model.approximateMb * 1_400_000L) {
        "모델 파일 크기가 등록 정보와 다릅니다."
      }
      require(model.sha256 == null || model.sha256 == rawHash) {
        "등록된 모델 버전과 제공 파일의 체크섬이 다릅니다. 자동 교체하지 않습니다."
      }
      RemoteModel(size, rawHash)
    } finally { conn.disconnect() }
  }

  /** Recover a DownloadManager job if the process died between enqueue and persisting its ID. */
  private fun matchingJobs(ctx: Context, model: AiModelDefinition): List<Long> {
    val result = mutableListOf<Long>()
    val path = partial(ctx, model.id).absolutePath
    requireNotNull(manager(ctx).query(DownloadManager.Query())) {
      "다운로드 기록을 확인할 수 없습니다."
    }.use { rows ->
      while (rows.moveToNext()) {
        val uri = rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_URI))
        val title = rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE))
        val local = rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
        if (uri == model.downloadUrl && title == "Push Office · " + model.title &&
            (local == null || Uri.parse(local).path == path)) {
          result.add(rows.getLong(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_ID)))
        }
      }
    }
    return result
  }

  private fun recoverJob(ctx: Context, model: AiModelDefinition): Long {
    val id = model.id
    val recorded = downloadId(ctx, id)
    if (recorded != 0L) return recorded
    if (expectedSize(ctx, id) <= 0 || expectedSha(ctx, id) != model.sha256 ||
        model.sha256 == null || target(ctx, id).exists()) return 0L
    val jobs = matchingJobs(ctx, model)
    require(jobs.size <= 1) { "중복 다운로드 기록이 있습니다. 오류 모델 데이터를 삭제한 뒤 재시도해 주세요." }
    val recovered = jobs.singleOrNull() ?: return 0L
    check(prefs(ctx).edit().putLong(id + "_download", recovered).commit())
    return recovered
  }

  private fun state(ctx: Context, id: String): Map<String, Any> {
    val requestId = recoverJob(ctx, AiModelCatalog.get(id))
    if (requestId == 0L) {
      val failure = prefs(ctx).getString(id + "_failure", null)
      if (failure != null) return mapOf("state" to "error", "message" to failure)
      return mapOf("state" to "not_installed", "bytesDownloaded" to 0L, "totalBytes" to 0L)
    }
    val query = DownloadManager.Query().setFilterById(requestId)
    val cursor = manager(ctx).query(query)
    if (cursor == null) return mapOf("state" to "error", "reservationUnknown" to true,
      "message" to "다운로드 기록을 확인할 수 없습니다.")
    cursor.use {
      if (!it.moveToFirst()) return mapOf("state" to "error", "message" to "다운로드 기록이 삭제됐습니다.")
      val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val done = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      val reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      return when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> mapOf("state" to "verifying", "bytesDownloaded" to done, "totalBytes" to total)
        DownloadManager.STATUS_FAILED -> mapOf("state" to "error", "message" to when (reason) {
          DownloadManager.ERROR_INSUFFICIENT_SPACE -> "저장 공간이 부족합니다. 공간을 확보한 뒤 다시 요청해 주세요."
          DownloadManager.ERROR_CANNOT_RESUME -> "중단된 전송을 이어받을 수 없습니다. 다운로드 재시도를 눌러 주세요."
          DownloadManager.ERROR_DEVICE_NOT_FOUND -> "모델 저장 공간을 사용할 수 없습니다. 저장소를 확인해 주세요."
          else -> "다운로드에 실패했습니다. Wi-Fi 및 저장 공간을 확인한 뒤 다시 요청해 주세요."
        })
        DownloadManager.STATUS_PAUSED -> mapOf("state" to "downloading",
          "message" to when (reason) {
            DownloadManager.PAUSED_QUEUED_FOR_WIFI, DownloadManager.PAUSED_WAITING_FOR_NETWORK ->
              "Wi-Fi 연결 대기 중입니다. 기존 다운로드가 연결 복구 후 이어집니다."
            DownloadManager.PAUSED_WAITING_TO_RETRY -> "Android가 기존 전송 재시도를 기다리고 있습니다."
            else -> "기존 다운로드가 일시 대기 중입니다."
          }, "bytesDownloaded" to done, "totalBytes" to total)
        else -> mapOf("state" to "downloading", "bytesDownloaded" to done, "totalBytes" to total)
      }
    }
  }

  private suspend fun finish(ctx: Context, model: AiModelDefinition): Boolean {
    val file = partial(ctx, model.id)
    val expected = expectedSize(ctx, model.id)
    val sha = expectedSha(ctx, model.id)
    if (!file.isFile || file.length() != expected || expected < 100_000_000 ||
        !sha.matches(Regex("[a-f0-9]{64}")) || sha != model.sha256) return false
    val before = stamp(file, sha) ?: return false
    if (!fullMatch(file, expected, sha) || stamp(file, sha) != before) return false
    val target = target(ctx,model.id)
    if (target.exists() || !file.renameTo(target)) return false
    // A crash after rename is recoverable: the next list fully verifies the final file.
    check(prefs(ctx).edit().remove(model.id + "_download").remove(model.id + "_failure")
      .remove(model.id + "_corrupt").commit())
    stamp(target, sha)?.let { statusCache.record(model.id, it, SystemClock.elapsedRealtime()) }
    return true
  }

  suspend fun list(ctx: Context): List<Map<String, Any>> {
    val nano = NanoClient.status()
    return operations.withLock { withContext(Dispatchers.IO) {
      val resources = capacity(ctx)
      val rows = AiModelCatalog.models.map { model ->
        val status = if (model.file == null) {
          mapOf("state" to (nano["status"]?.toString() ?: "error"), "message" to (nano["message"]?.toString() ?: ""))
        } else try {
          when {
            verifyLocked(ctx, model, listOnly = true) != null -> mapOf("state" to "installed")
            prefs(ctx).getBoolean(model.id + "_corrupt", false) ->
              mapOf("state" to "error", "message" to "모델 무결성을 확인하지 못했습니다. 다시 다운로드해 주세요.")
            else -> {
              val queued = state(ctx, model.id)
              if (queued["state"] != "verifying") queued
              else if (finish(ctx, model)) mapOf("state" to "installed")
              else {
                clear(ctx, model.id, true)
                val message = "다운로드 파일의 크기 또는 SHA-256이 일치하지 않습니다. 다시 다운로드해 주세요."
                check(prefs(ctx).edit().putString(model.id + "_failure", message).commit())
                mapOf("state" to "error", "message" to message)
              }
            }
          }
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) {
          mapOf("state" to "error", "message" to "모델 저장소 또는 다운로드 기록을 확인하지 못했습니다.")
        }
        val current = status["state"]?.toString() ?: "error"
        mapOf<String, Any>("id" to model.id, "title" to model.title,
          "description" to model.description, "engine" to if (model.file == null) "AICore" else "LiteRT-LM",
          "license" to if (model.file == null) "시스템 관리" else "Apache-2.0",
          "approximateMb" to model.approximateMb, "sourceUrl" to model.sourceUrl,
          "state" to current, "selected" to (selected(ctx) == model.id),
          "bytesDownloaded" to (status["bytesDownloaded"] ?: 0L),
          "totalBytes" to (status["totalBytes"] ?: expectedSize(ctx, model.id)),
          "message" to (status["message"] ?: ""),
          "minAvailableMb" to model.minAvailableMb,
          "availableMemoryMb" to resources.availableRamBytes / 1_000_000L,
          "totalMemoryMb" to resources.totalRamBytes / 1_000_000L,
          "freeStorageMb" to if (resources.freeStorageBytes < 0) -1L else resources.freeStorageBytes / 1_000_000L,
          "memoryReady" to resources.memoryReady(model),
          "storageReady" to resources.estimatedStorageReady(model))
      }
      val recommended = AiModelResources.recommendedId(resources, rows.associate {
        it.getValue("id").toString() to it.getValue("state").toString()
      })
      rows.map { row -> row + ("recommended" to (row["id"] == recommended)) }
    } }
  }

  /** DownloadManager resumes an existing paused request; terminal failures need explicit retry. */
  suspend fun download(ctx: Context, id: String): Map<String, Any> =
    operations.withLock { withContext(Dispatchers.IO) {
      val model = AiModelCatalog.get(id)
      if (id == "gemini-nano") return@withContext mapOf("state" to "system_managed",
        "message" to "Gemini Nano 모델은 Android AICore에서 관리합니다. 전용 다운로드 기능을 사용해 주세요.")
      if (verifyLocked(ctx, model) != null) return@withContext mapOf("state" to "installed")
      val queued = state(ctx, id)
      require(queued["reservationUnknown"] != true) { "기존 다운로드 상태를 다시 확인해 주세요." }
      if (queued["state"] in listOf("downloading", "verifying"))
        return@withContext queued + ("message" to "이미 다운로드 중이거나 검증 대기 중입니다.")
      val remote = remoteMetadata(model)
      val folder = directory(ctx)
      val outstanding = AiModelCatalog.models.filter { it.file != null && it.id != id }.mapNotNull { other ->
        val status = state(ctx, other.id)
        require(status["reservationUnknown"] != true) { "진행 중인 다운로드 상태를 다시 확인해 주세요." }
        if (status["state"] in listOf("downloading", "verifying"))
          AiModelResources.remaining(expectedSize(ctx, other.id), (status["bytesDownloaded"] as? Number)?.toLong() ?: 0L)
        else null
      }
      require(AiModelResources.enoughStorage(StatFs(folder.path).availableBytes, remote.size, outstanding)) {
        "여유 저장 공간이 부족합니다. 진행 중인 모델 및 300MB 여유 공간을 포함해 확보해 주세요."
      }
      clear(ctx,id,true)
      val stale = target(ctx,id)
      require(!stale.exists() || stale.delete()) { "손상된 모델 파일을 교체하지 못했습니다." }
      check(prefs(ctx).edit().putLong(id + "_bytes",remote.size).putString(id + "_sha",remote.sha).commit()) {
        "모델 검증 정보를 저장하지 못했습니다."
      }
      val request = DownloadManager.Request(Uri.parse(model.downloadUrl)).apply {
        setTitle("Push Office · " + model.title)
        setDescription("기기 내 AI 모델")
        setMimeType("application/octet-stream")
        setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
        setAllowedOverMetered(false)
        setAllowedOverRoaming(false)
        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        setDestinationInExternalFilesDir(ctx,null,"ai_models/" + id + ".part")
      }
      val next = try { manager(ctx).enqueue(request) } catch (_: Exception) {
        val message = "다운로드를 시작하지 못했습니다. Wi-Fi와 저장 공간을 확인해 주세요."
        prefs(ctx).edit().putString(id + "_failure", message).commit()
        return@withContext mapOf("state" to "error", "message" to message)
      }
      if (!prefs(ctx).edit().putLong(id + "_download",next).commit()) {
        // If cleanup itself fails, the matching job can be rediscovered on the next read.
        runCatching { manager(ctx).remove(next) }
        error("다운로드 기록을 저장하지 못했습니다. 상태를 다시 확인해 주세요.")
      }
      mapOf("state" to "downloading", "message" to "Wi-Fi에서 모델 다운로드를 시작했습니다.")
    } }

  private fun clear(ctx: Context, id: String, erasePending: Boolean) {
    val model = AiModelCatalog.get(id)
    statusCache.invalidate(id)
    val jobs = (matchingJobs(ctx, model) + downloadId(ctx, id)).filter { it != 0L }.distinct()
    if (jobs.isNotEmpty()) manager(ctx).remove(*jobs.toLongArray())
    val pending = partial(ctx,id)
    if (erasePending) require(!pending.exists() || pending.delete()) { "임시 모델 파일을 삭제하지 못했습니다." }
    check(prefs(ctx).edit().remove(id + "_download").remove(id + "_sha").remove(id + "_bytes")
      .remove(id + "_corrupt").remove(id + "_failure").commit())
  }

  suspend fun remove(ctx: Context, id: String): Map<String, Any> =
    operations.withLock { withContext(Dispatchers.IO) {
      val model = AiModelCatalog.get(id)
      require(id != "gemini-nano") { "Gemini Nano는 Android AICore에서 관리합니다." }
      val wasSelected = prefs(ctx).getString(SELECTED,"gemini-nano") == id
      clear(ctx,id,true)
      val local = target(ctx,model.id)
      require(!local.exists() || local.delete()) { "기기 모델 파일을 삭제하지 못했습니다." }
      if (wasSelected) check(prefs(ctx).edit().putString(SELECTED,"gemini-nano").commit())
      mapOf("state" to "not_installed", "message" to "모델이 삭제됐습니다.")
    } }

  suspend fun choose(ctx: Context, id: String): Map<String, Any> =
    operations.withLock { withContext(Dispatchers.IO) {
      val model = AiModelCatalog.get(id)
      if (id == "gemini-nano") {
        require(NanoClient.status()["status"] == "available") {
          "Gemini Nano 사용 가능 상태를 확인한 뒤 선택해 주세요."
        }
      } else {
        require(memoryCapacity(ctx).memoryReady(model)) { "현재 사용 가능한 RAM을 확인해 주세요." }
        require(verifyLocked(ctx, model) != null) {
          "모델 전체 파일 SHA-256 검증에 실패했습니다. 다시 다운로드한 뒤 선택해 주세요."
        }
      }
      require(prefs(ctx).edit().putString(SELECTED,id).commit()) { "선택 모델을 저장하지 못했습니다." }
      mapOf("selected" to id)
    } }
}

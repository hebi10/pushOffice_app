package expo.modules.pushoffice

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.StatFs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import java.security.MessageDigest
import java.time.ZonedDateTime

/** App-scoped downloads, source SHA256 checks, opt-in install and deletion. */
internal object AiModelDownloadStore {
  private const val PREF = "push_office_ai_models"
  private const val SELECTED = "selected"
  private val lock = Any()

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
    return file.isFile && expected > 0 && file.length() == expected &&
      expectedSha(ctx, model.id).matches(Regex("[a-f0-9]{64}"))
  }

  fun installedFile(ctx: Context, model: AiModelDefinition): File? =
    if (model.file != null && available(ctx,model)) target(ctx, model.id) else null

  fun selected(ctx: Context): String {
    val id = prefs(ctx).getString(SELECTED, "gemini-nano") ?: "gemini-nano"
    if (id == "gemini-nano") return id
    val model = AiModelCatalog.models.firstOrNull { it.id == id } ?: return "gemini-nano"
    return if (installedFile(ctx,model) != null) id else "gemini-nano"
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

  private fun state(ctx: Context, id: String): Map<String, Any> {
    val requestId = downloadId(ctx, id)
    if (requestId == 0L) return mapOf("state" to "not_installed", "bytesDownloaded" to 0L, "totalBytes" to 0L)
    val query = DownloadManager.Query().setFilterById(requestId)
    val cursor = manager(ctx).query(query)
    if (cursor == null) return mapOf("state" to "error", "message" to "다운로드 기록을 확인할 수 없습니다.")
    cursor.use {
      if (!it.moveToFirst()) return mapOf("state" to "error", "message" to "다운로드 기록이 삭제됐습니다.")
      val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val done = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      return when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> mapOf("state" to "verifying", "bytesDownloaded" to done, "totalBytes" to total)
        DownloadManager.STATUS_FAILED -> mapOf("state" to "error",
          "message" to "다운로드에 실패했습니다. Wi-Fi 연결 및 남은 저장 공간을 확인한 뒤 다시 요청해 주세요.")
        DownloadManager.STATUS_PAUSED -> mapOf("state" to "downloading",
          "message" to "다운로드가 대기 중입니다. Wi-Fi 연결을 확인해 주세요.",
          "bytesDownloaded" to done, "totalBytes" to total)
        else -> mapOf("state" to "downloading", "bytesDownloaded" to done, "totalBytes" to total)
      }
    }
  }

  private suspend fun finish(ctx: Context, model: AiModelDefinition): Boolean = withContext(Dispatchers.IO) {
    val file = partial(ctx, model.id)
    val expected = expectedSize(ctx, model.id)
    val sha = expectedSha(ctx, model.id)
    if (!file.isFile || file.length() != expected || expected < 100_000_000 ||
        !sha.matches(Regex("[a-f0-9]{64}"))) return@withContext false
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).buffered(1024*1024).use { stream ->
      val buffer = ByteArray(1024*1024)
      while(true) {
        val n = stream.read(buffer)
        if(n < 0) break
        digest.update(buffer,0,n)
      }
    }
    val actual = digest.digest().joinToString("") { "%02x".format(it) }
    if(actual != sha) return@withContext false
    val target = target(ctx,model.id)
    if (target.exists() || !file.renameTo(target)) return@withContext false
    prefs(ctx).edit().remove(model.id + "_download").apply()
    true
  }

  suspend fun list(ctx: Context): List<Map<String, Any>> {
    val nano = NanoClient.status()
    return AiModelCatalog.models.map { model ->
      val current = if (model.id == "gemini-nano") {
        nano["status"]?.toString() ?: "error"
      } else if (available(ctx,model)) "installed" else {
        val state = state(ctx,model.id)
        if (state["state"] == "verifying") {
          if (finish(ctx,model)) "installed" else {
            clear(ctx,model.id,true)
            "error"
          }
        } else state["state"]?.toString() ?: "error"
      }
      val queued = if (model.id != "gemini-nano" && current == "downloading") state(ctx,model.id) else emptyMap()
      mapOf("id" to model.id, "title" to model.title,
        "description" to model.description, "engine" to if (model.id == "gemini-nano") "AICore" else "LiteRT-LM",
        "license" to if (model.id == "gemini-nano") "시스템 관리" else "Apache-2.0",
        "approximateMb" to model.approximateMb, "sourceUrl" to model.sourceUrl,
        "state" to current, "selected" to (selected(ctx) == model.id),
        "bytesDownloaded" to (queued["bytesDownloaded"] ?: 0L),
        "totalBytes" to (queued["totalBytes"] ?: expectedSize(ctx,model.id)),
        "message" to if (model.id == "gemini-nano") (nano["message"]?.toString() ?: "")
          else if (current == "error") "다운로드를 확인하지 못했습니다. 다시 요청해 주세요."
          else (queued["message"] ?: "")
      )
    }
  }

  /** DownloadManager keeps working if the app leaves foreground. Never automatically retry failed downloads. */
  suspend fun download(ctx: Context, id: String): Map<String, Any> {
    val model = AiModelCatalog.get(id)
    if (id == "gemini-nano") return mapOf("state" to "system_managed",
      "message" to "Gemini Nano 모델은 Android AICore에서 관리합니다. 전용 다운로드 기능을 사용해 주세요.")
    if (available(ctx,model)) return mapOf("state" to "installed")
    if (downloadId(ctx,id) > 0L && state(ctx,id)["state"] in listOf("downloading", "verifying"))
      return mapOf("state" to "downloading", "message" to "이미 다운로드 중입니다.")
    val remote = remoteMetadata(model)
    return withContext(Dispatchers.IO) {
      synchronized(lock) {
        if (downloadId(ctx,id) > 0L && state(ctx,id)["state"] in listOf("downloading","verifying")) {
          return@synchronized mapOf("state" to "downloading", "message" to "이미 다운로드 중입니다.")
        }
        val folder = directory(ctx)
        require(StatFs(folder.path).availableBytes > remote.size + 300_000_000L) {
          "여유 저장 공간이 부족합니다. 모델 파일 크기에 300MB 이상을 추가 확보해 주세요."
        }
        clear(ctx,id,true)
        prefs(ctx).edit().putLong(id + "_bytes",remote.size)
          .putString(id + "_sha",remote.sha).commit().also {
            require(it) { "모델 검증 정보를 저장하지 못했습니다." }
          }
        val request = DownloadManager.Request(Uri.parse(model.downloadUrl)).apply {
          setTitle("Push Office · " + model.title)
          setDescription("기기 내 AI 모델")
          setMimeType("application/octet-stream")
          setAllowedOverMetered(false)
          setAllowedOverRoaming(false)
          setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
          setDestinationInExternalFilesDir(ctx,null,"ai_models/" + id + ".part")
        }
        val next = manager(ctx).enqueue(request)
        prefs(ctx).edit().putLong(id + "_download",next).apply()
        mapOf("state" to "downloading", "message" to "Wi-Fi에서 모델 다운로드를 시작했습니다.")
      }
    }
  }

  private fun clear(ctx: Context, id: String, erasePending: Boolean) {
    val job = downloadId(ctx,id)
    if (job != 0L) manager(ctx).remove(job)
    if (erasePending) partial(ctx,id).delete()
    prefs(ctx).edit().remove(id + "_download").remove(id + "_sha").remove(id + "_bytes").apply()
  }

  suspend fun remove(ctx: Context, id: String): Map<String, Any> = withContext(Dispatchers.IO) {
    val model = AiModelCatalog.get(id)
    require(id != "gemini-nano") { "Gemini Nano는 Android AICore에서 관리합니다." }
    synchronized(lock) {
      val wasSelected = prefs(ctx).getString(SELECTED,"gemini-nano") == id
      clear(ctx,id,true)
      val local = target(ctx,model.id)
      require(!local.exists() || local.delete()) { "기기 모델 파일을 삭제하지 못했습니다." }
      if (wasSelected) prefs(ctx).edit().putString(SELECTED,"gemini-nano").apply()
      mapOf("state" to "not_installed", "message" to "모델이 삭제됐습니다.")
    }
  }

  suspend fun choose(ctx: Context, id: String): Map<String, Any> {
    val model = AiModelCatalog.get(id)
    if (id == "gemini-nano") {
      require(NanoClient.status()["status"] == "available") {
        "Gemini Nano 사용 가능 상태를 확인한 뒤 선택해 주세요."
      }
    } else require(installedFile(ctx,model) != null) { "모델을 설치한 뒤 선택해 주세요." }
    require(prefs(ctx).edit().putString(SELECTED,id).commit()) { "선택 모델을 저장하지 못했습니다." }
    return mapOf("selected" to id)
  }
}

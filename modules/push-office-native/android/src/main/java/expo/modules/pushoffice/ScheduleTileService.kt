package expo.modules.pushoffice

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class ScheduleTileService : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    qsTile?.apply {
      state=Tile.STATE_ACTIVE
      label=getString(R.string.tile_label)
      contentDescription=getString(R.string.tile_content_description)
      if(Build.VERSION.SDK_INT>=29) subtitle=getString(R.string.tile_subtitle)
      updateTile()
    }
  }
  override fun onClick() {
    super.onClick()
    val open=Runnable {
      val intent=Intent(this,QuickEntryActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if(Build.VERSION.SDK_INT>=34) startActivityAndCollapse(PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
      else { @Suppress("DEPRECATION") startActivityAndCollapse(intent) }
    }
    if(isLocked) unlockAndRun(open) else open.run()
  }
}

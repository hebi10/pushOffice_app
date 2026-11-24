package expo.modules.pushoffice

import java.time.ZoneId
import java.time.ZonedDateTime
import android.content.Intent
import org.junit.Assert.*
import org.junit.Test

class ScheduleConflictsTest {
  private val zone=ZoneId.of("Asia/Seoul")
  private val start=ZonedDateTime.of(2027,1,10,9,0,0,0,zone).toInstant().toEpochMilli()
  private fun record(id: String, at: Long=start, end: Long?=null, repeat: String="none") =
    ScheduleRecord(id,"local","event",id,at,endAt=end,repeatType=repeat,createdAt=1,updatedAt=2,anchorZone=zone.id)
  private fun find(draft: ScheduleRecord, vararg other: ScheduleRecord) =
    ScheduleConflicts.find(draft,other.toList(),start-86400000L,zone)
  @Test fun pointIntervalsAndAdjacentEndpointsHaveDefinedOverlap() {
    val meeting=record("meeting",start,start+3600000)
    assertEquals(listOf("meeting"),find(record("point",start+60000),meeting).map { it.id })
    assertTrue(find(record("point",start+3600000),meeting).isEmpty())
    assertTrue(find(record("adjacent",start+3600000,start+7200000),meeting).isEmpty())
    assertEquals(1,find(record("same"),record("point")).size)
    assertEquals(1,find(record("prior",start-3600000,start+60000),meeting).size)
    assertTrue(find(meeting,meeting).isEmpty())
  }
  @Test fun crossMidnightAllDayAndDstIntervalsAreComparedByActualEpoch() {
    val midnight=ZonedDateTime.of(2027,1,11,0,0,0,0,zone).toInstant().toEpochMilli()
    val allDay=record("all-day",midnight).copy(isAllDay=true)
    assertEquals(1,find(record("night",midnight-60000,midnight+60000),allDay).size)
    assertTrue(find(record("tomorrow",midnight+86400000L),allDay).isEmpty())
    val ny=ZoneId.of("America/New_York")
    val dst=ZonedDateTime.of(2027,3,14,0,0,0,0,ny).toInstant().toEpochMilli()
    val dstDay=record("DST",dst).copy(anchorZone=ny.id,isAllDay=true)
    assertEquals(1,find(record("inside",dst+22*3600000L),dstDay).size)
    assertTrue(find(record("boundary",dst+23*3600000L),dstDay).isEmpty())
  }
  @Test fun recurringExceptionsCompletedRowsAndSelfOccurrenceAreHandled() {
    val day=86400000L
    val series=record("series",start,start+3600000,"daily").copy(excludedStarts=listOf(start+day))
    assertTrue(find(record("excluded",start+day+60000),series).isEmpty())
    assertTrue(find(record("done",start+60000),series.copy(completedAt=start)).isEmpty())
    assertEquals(1,find(record("future",start+2*day+60000),series).size)
    val edited=series.copy(repeatType="none",startAt=start+2*day,endAt=start+2*day+3600000,excludedStarts=emptyList())
    assertTrue(ScheduleConflicts.find(edited,listOf(series),start-1,zone,start+2*day).isEmpty())
    val moved=edited.copy(startAt=start+3*day,endAt=start+3*day+3600000)
    assertEquals(1,ScheduleConflicts.find(moved,listOf(series),start-1,zone,start+2*day).size)
    val repeating=record("new",start,start+3600000,"weekly")
    assertTrue(find(repeating,record("later",start+35*day+60000)).isEmpty())
    assertEquals(1,find(repeating,record("within",start+28*day+60000)).size)
    val hits=ScheduleConflicts.find(record("one"),List(12){record("other-$it")},start-1,zone)
    assertEquals(8,hits.size)
  }
  @Test fun sharedInputRejectsUnsupportedIntentAndOversizeWithoutTruncating() {
    assertEquals("내일 오후 3시 회의\n메모",SharedScheduleText.accept(Intent.ACTION_SEND,"text/plain","  내일 오후 3시 회의\r\n메모 "))
    assertNull(SharedScheduleText.accept(Intent.ACTION_VIEW,"text/plain","일정"))
    assertNull(SharedScheduleText.accept(Intent.ACTION_SEND_MULTIPLE,"text/plain","일정"))
    assertNull(SharedScheduleText.accept(Intent.ACTION_SEND,"text/html","<b>일정</b>"))
    assertNull(SharedScheduleText.accept(Intent.ACTION_SEND,"text/plain","a".repeat(4097)))
    assertNull(SharedScheduleText.accept(Intent.ACTION_SEND,"text/plain","일정\u0000확인"))
    assertNull(SharedScheduleText.accept(Intent.ACTION_SEND,"text/plain"," \n "))
  }
}

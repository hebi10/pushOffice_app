import unittest
from datetime import date
import xml.etree.ElementTree as ET

from calendar_capture_target import agenda_jump_label, day_label, exact_clickable_center, native_scroll_swipe, week_shift

APP = "com.hebi96.pushOffice_app"

def node(parent, label, bounds="[10,20][110,60]", **attrs):
    attributes = {"content-desc":label, "bounds":bounds, "package":APP,
                  "clickable":"true", "enabled":"true"}
    attributes.update(attrs)
    return ET.SubElement(parent, "node", attributes)

class CalendarCaptureTargetTest(unittest.TestCase):
    def test_week_boundaries(self):
        self.assertEqual(week_shift(date(2026,11,24), date(2026,11,25)),0)
        self.assertEqual(week_shift(date(2026,11,28), date(2026,11,29)),1)
        self.assertEqual(week_shift(date(2026,12,31), date(2027,1,1)),0)
        self.assertEqual(week_shift(date(2027,1,3), date(2027,1,2)),-1)
        self.assertEqual(day_label(date(2026,11,29),1),"11월 29일 일요일, 일정 1건")
        self.assertEqual(day_label(date(2028,2,29),2),"2월 29일 화요일, 일정 2건")
        self.assertEqual(agenda_jump_label(date(2026,11,27)),"선택 날짜 일정 목록으로 이동: 11월 27일 금요일")

    def test_exact_enabled_app_control_only(self):
        root=ET.Element("hierarchy")
        label=day_label(date(2026,11,29),1)
        node(root,label,clickable="false",bounds="[50,200][300,300]")
        node(root,label,package="com.example.other")
        node(root,label,enabled="false")
        node(root,label+" 추가")
        node(root,label,bounds="[0,0][0,0]")
        node(root,label,bounds="[120,300][220,400]")
        self.assertEqual(exact_clickable_center(root,label,APP),(170,350))
        self.assertIsNone(exact_clickable_center(root,"없는 날짜",APP))
        node(root,label,bounds="[240,300][340,400]")
        with self.assertRaises(RuntimeError):
            exact_clickable_center(root,label,APP)

    def test_compact_native_confirmation_swipe_stays_above_fixed_actions(self):
        root=ET.Element("hierarchy")
        scroll={"class":"android.widget.ScrollView","scrollable":"true"}
        node(root,"confirmation content",bounds="[19,42][620,968]",**scroll)
        node(root,"일정 저장",bounds="[50,1086][589,1173]")
        node(root,"system IME",bounds="[0,980][640,1360]",package="com.android.inputmethod.latin",**scroll)
        self.assertEqual(native_scroll_swipe(root,APP),(319,782,319,412))
        node(root,"ambiguous",bounds="[10,10][400,600]",**scroll)
        with self.assertRaises(RuntimeError):
            native_scroll_swipe(root,APP)

    def test_compact_date_requires_exact_focused_start_edit_text(self):
        root=ET.Element("hierarchy")
        label="날짜 (YYYY-MM-DD)"
        kind={"class":"android.widget.EditText"}
        node(root,label,bounds="[10,10][80,50]",**{"class":"android.widget.TextView"})
        node(root,"종료 "+label,bounds="[50,400][500,480]",focused="true",**kind)
        start=node(root,label,bounds="[50,270][500,350]",focused="false",**kind)
        self.assertEqual(exact_clickable_center(root,label,APP,class_name=kind["class"]),(275,310))
        self.assertIsNone(exact_clickable_center(root,label,APP,class_name=kind["class"],focused=True))
        start.set("focused","true")
        self.assertEqual(exact_clickable_center(root,label,APP,class_name=kind["class"],focused=True),(275,310))

if __name__ == "__main__":
    unittest.main()

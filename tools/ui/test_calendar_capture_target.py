import unittest
from datetime import date
import xml.etree.ElementTree as ET

from calendar_capture_target import day_label, exact_clickable_center, week_shift

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

if __name__ == "__main__":
    unittest.main()

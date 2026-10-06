import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  CheckCheck,
  House,
  Layers3,
  Settings2,
  StickyNote,
  Timer,
} from "lucide-react";
export const navigation = [
  { href: "/", label: "Home", icon: House, description: "Your week, in view." },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    description: "Make space for your week.",
  },
  {
    href: "/courses",
    label: "Courses",
    icon: BookOpen,
    description: "A home for every subject.",
  },
  {
    href: "/grades",
    label: "Grades",
    icon: GraduationCap,
    description: "Course assessments and grades.",
  },
  {
    href: "/todo",
    label: "To-do",
    icon: CheckCheck,
    description: "One thing at a time.",
  },
  {
    href: "/notes",
    label: "Notes",
    icon: StickyNote,
    description: "A little room to think.",
  },
  {
    href: "/focus",
    label: "Focus",
    icon: Timer,
    description: "Give your attention a place.",
  },
  {
    href: "/semesters",
    label: "Semesters",
    icon: Layers3,
    description: "Every chapter, kept together.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings2,
    description: "Make yourself at home.",
  },
] as const;

import { FileText, Home, Layers, Megaphone, MessagesSquare, Radar, Settings, Users, UsersRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "unread" | "hot";
  /** Pressed after "g": g h → Home. */
  key: string;
  /** Extra words the command palette matches. */
  words?: string;
};

export type NavSection = { title?: string; items: NavItem[] };

/** The sidebar, top to bottom: the day's work, then sending, then the people it goes to. */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/", label: "Home", icon: Home, end: true, key: "h", words: "dashboard overview today" },
      { to: "/inbox", label: "Inbox", icon: MessagesSquare, badge: "unread", key: "i", words: "chats messages replies conversations" },
      { to: "/leads", label: "Leads", icon: Radar, badge: "hot", key: "l", words: "lead radar hot buyers qr codes links trade show" },
    ],
  },
  {
    title: "Campaigns",
    items: [
      { to: "/campaigns", label: "Broadcasts", icon: Megaphone, key: "b", words: "campaigns send bulk schedule" },
      { to: "/templates", label: "Templates", icon: FileText, key: "t", words: "saved messages" },
    ],
  },
  {
    title: "Audience",
    items: [
      { to: "/clients", label: "Clients", icon: Users, key: "c", words: "contacts customers buyers numbers" },
      { to: "/batches", label: "Batches", icon: Layers, key: "a", words: "lists segments" },
      { to: "/groups", label: "Groups", icon: UsersRound, key: "r", words: "whatsapp groups communities" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { to: "/settings", label: "Settings", icon: Settings, key: "s", words: "preferences ai sending safety business" };

export const ALL_NAV: NavItem[] = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_ITEM];

/** "⌘" on a Mac, "Ctrl" elsewhere. */
export const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

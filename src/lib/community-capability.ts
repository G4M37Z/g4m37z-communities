// V2 Community Module — reusable capability architecture
// Builds on existing V1 communities (public.communities, community_members)
// No new DB schema — extends existing with capability flags

export interface CommunityCapability {
  id: string;           // 'discussions', 'media', 'voice', 'events', 'polls', 'leaderboard'
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  visible: boolean;
  requiresRole?: string[];
  routePattern: string;  // relative route for module
  order: number;
}

export const DEFAULT_COMMUNITY_CAPABILITIES: CommunityCapability[] = [
  { id: "discussions", label: "Discussions", description: "Text posts and threaded replies", icon: "MessageSquare", enabled: true, visible: true, order: 1, routePattern: "/communities/{slug}/discussions" },
  { id: "media", label: "Media", description: "Images and GIF references", icon: "Image", enabled: true, visible: true, order: 2, routePattern: "/communities/{slug}/media" },
  { id: "voice", label: "Voice", description: "Community voice rooms", icon: "Mic", enabled: true, visible: true, requiresRole: ["moderator","admin","owner"], order: 3, routePattern: "/communities/{slug}/voice" },
  { id: "events", label: "Events", description: "Community activities", icon: "Calendar", enabled: false, visible: false, order: 4, routePattern: "/communities/{slug}/events" },
  { id: "polls", label: "Polls", description: "Community polls", icon: "BarChart3", enabled: false, visible: false, order: 5, routePattern: "/communities/{slug}/polls" },
];

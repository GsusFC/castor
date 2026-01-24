/**
 * Unified Spacing System for Castor
 * Based on redesign vision for consistent visual hierarchy
 *
 * All values use Tailwind scale (1 = 4px)
 */

/**
 * Spacing Scale
 * Micro (1): 4px   - Only adjacent icons
 * Small (1.5): 6px - Related elements
 * Base (2): 8px    - Standard spacing
 * Med (3): 12px    - Important separation
 * Large (4): 16px  - Section separation
 */

export const SPACING = {
  // Micro spacing - use sparingly
  MICRO: 'gap-1',         // 4px
  MICRO_SM: 'gap-1.5',    // 6px

  // Standard spacing
  BASE: 'gap-2',          // 8px
  BASE_SM: 'gap-2.5',     // 10px
  GENEROUS: 'gap-3',      // 12px
  GENEROUS_LG: 'gap-3.5', // 14px

  // Large spacing - between sections
  LARGE: 'gap-4',         // 16px
  LARGE_XL: 'gap-5',      // 20px
  XLARGE: 'gap-6',        // 24px
} as const

/**
 * Header System
 */
export const HEADER = {
  // DashboardHeader - Primary navigation
  PRIMARY: {
    height: 'h-14 sm:h-16',
    padding: 'p-3 sm:p-4',
    gap: 'gap-3 sm:gap-4',
    bgClass: 'bg-card/80 backdrop-blur-xl border-b border-border',
  },

  // TabNav - Secondary navigation (sticky below primary)
  TABS: {
    // Container styling
    container: 'h-12 sm:h-14',
    containerPadding: 'p-1.5 sm:p-2',
    containerBg: 'rounded-full bg-muted/40',

    // Pills styling
    pill: {
      base: 'px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all',
      active: 'bg-background text-foreground shadow-md border border-border/30',
      inactive: 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
    },

    // Container gap between pills
    gap: 'gap-2 sm:gap-3',

    // Sticky positioning
    stickyTop: 'top-14 sm:top-16',
    bgClass: 'bg-background/95 backdrop-blur-sm border-b border-border/50',

    // Icon styling
    iconSize: 'w-4 h-4 sm:w-4 sm:h-4',
    iconText: 'gap-1.5 sm:gap-2',
  },

  // ViewHeader - Page titles
  VIEW: {
    height: 'h-12 sm:h-14',
    padding: 'p-3 sm:p-4',
    gap: 'gap-3',
    bgClass: 'bg-background/95 backdrop-blur-sm border-b border-border/50',
  },

  // Profile/Channel header info section
  PROFILE_INFO: {
    padding: 'p-6 sm:p-8',
    spaceY: 'space-y-3 sm:space-y-4',
  },
} as const

/**
 * Hero Zones - Banners with avatar overlaps
 */
export const HERO = {
  // Channel/Profile banner sizes
  BANNER: {
    // Channel header
    CHANNEL: 'aspect-[3/1]',
    // Profile header - larger
    PROFILE: 'aspect-[3/1]',
  },

  // Avatar overlap - proportional to avatar size
  AVATAR_OFFSET: {
    // For 80-96px avatars (standard)
    STANDARD: '-mt-16 sm:-mt-20',
    // For large 96-120px avatars (profiles)
    LARGE: '-mt-20 sm:-mt-24',
    // For small 64px avatars
    SMALL: '-mt-12 sm:-mt-14',
  },

  // Avatar sizes
  AVATAR_SIZE: {
    SMALL: 'w-16 h-16 sm:w-20 sm:h-20',
    STANDARD: 'w-20 h-20 sm:w-24 sm:h-24',
    LARGE: 'w-24 h-24 sm:w-32 sm:h-32',
  },

  // Avatar border
  AVATAR_BORDER: 'border-[4px] border-card sm:border-[5px]',
} as const

/**
 * Card System
 */
export const CARD = {
  // Standard card
  DEFAULT: {
    padding: 'p-4 sm:p-5',
    rounded: 'rounded-lg',
    border: 'border border-border',
    gap: 'gap-3 sm:gap-4',
  },

  // Compact card
  COMPACT: {
    padding: 'p-3 sm:p-4',
    rounded: 'rounded-lg',
    border: 'border border-border',
    gap: 'gap-2 sm:gap-3',
  },

  // Profile info card
  PROFILE: {
    padding: 'p-6 sm:p-8',
    rounded: 'rounded-b-lg',
    border: 'border border-t-0 border-border',
    spaceY: 'space-y-3 sm:space-y-4',
  },
} as const

/**
 * Action Elements
 */
export const ACTIONS = {
  // Button container spacing
  CONTAINER: 'gap-2 sm:gap-3',
  CONTAINER_GENEROUS: 'gap-3 sm:gap-4',

  // Icon + Text spacing
  ICON_TEXT: 'gap-1.5 sm:gap-2',

  // Button padding
  BUTTON: 'px-3 py-2 sm:px-4 sm:py-2.5',

  // Primary action button (Follow, Create, etc)
  PRIMARY_BUTTON: {
    height: 'h-10 sm:h-11',
    padding: 'px-5 sm:px-6 py-2.5',
    text: 'text-sm sm:text-base font-semibold',
    gap: 'gap-1.5 sm:gap-2',
  },

  // Secondary action button (Share, Export, etc)
  SECONDARY_BUTTON: {
    height: 'h-10 sm:h-11',
    padding: 'px-4 sm:px-5 py-2.5',
    text: 'text-sm sm:text-base font-medium',
    gap: 'gap-1.5 sm:gap-2',
  },
} as const

/**
 * Navigation
 */
export const NAV = {
  // Sidebar/Nav items
  ITEMS: {
    spaceY: 'space-y-2',
    gap: 'gap-2 sm:gap-3',
    padding: 'px-3 py-2',
  },

  // Pill Tabs (used in AITabs, compose modes)
  PILL_TABS: {
    // Container styling
    container: 'h-10 sm:h-12',
    containerPadding: 'p-1.5 sm:p-2',
    containerBg: 'rounded-full bg-muted/40',

    // Individual pill styling
    pill: {
      base: 'px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all flex items-center justify-center relative',
      active: 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]',
      inactive: 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
    },

    // Icon + text spacing within pill
    gap: 'gap-2 sm:gap-3',
    iconText: 'gap-1.5 sm:gap-2',
    iconSize: 'w-4 h-4 sm:w-4 sm:h-4',
  },
} as const

/**
 * Content Sections
 */
export const CONTENT = {
  // Standard content spacing between items
  LIST: 'space-y-3 sm:space-y-4',
  // Compact list
  LIST_COMPACT: 'space-y-2 sm:space-y-3',
  // Large list with more breathing room
  LIST_GENEROUS: 'space-y-4 sm:space-y-5',

  // Within section spacing
  SECTION: 'space-y-2 sm:space-y-3',
  SECTION_GENEROUS: 'space-y-3 sm:space-y-4',
} as const

/**
 * Helper to combine spacing values
 */
export function combineSpacing(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Z-Index Scale
 */
export const ZINDEX = {
  // Behind content
  BG: 0,
  // Default
  DEFAULT: 10,
  // Dropdowns, popovers
  DROPDOWN: 20,
  // Sticky headers
  STICKY: 30,
  // Fixed headers
  FIXED: 40,
  // Modals
  MODAL: 50,
} as const

<script setup lang="ts">
import type { Component } from 'vue'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Camera,
  ChartColumnIncreasing,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Factory,
  HandCoins,
  Handshake,
  Home,
  Image,
  Info,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Minus,
  PackageOpen,
  Plus,
  Recycle,
  RefreshCw,
  Route,
  ScanSearch,
  Settings,
  Sparkle,
  Trash2,
  Upload,
  Weight,
  X
} from 'lucide-vue-next'

export type AppIconName =
  | 'overview'
  | 'chart'
  | 'scan'
  | 'arrow'
  | 'home'
  | 'leaf'
  | 'wallet'
  | 'truck'
  | 'spark'
  | 'sparkles'
  | 'check'
  | 'close'
  | 'logout'
  | 'settings'
  | 'box'
  | 'calendar'
  | 'people'
  | 'bell'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron'
  | 'camera'
  | 'image'
  | 'pin'
  | 'scale'
  | 'trash'
  | 'refresh'
  | 'building'
  | 'shield'
  | 'upload'
  | 'eye'
  | 'eye-off'
  | 'plus'
  | 'minus'
  | 'info'
  | 'alert'
  | 'external'

export type AppIconTone = 'plain' | 'brand'

const props = withDefaults(defineProps<{
  name: AppIconName | string
  size?: number | string
  strokeWidth?: number | string
  tone?: AppIconTone
  class?: string
}>(), {
  size: 24,
  strokeWidth: undefined,
  tone: 'plain'
})

const icons: Record<AppIconName, Component> = {
  overview: LayoutDashboard,
  chart: ChartColumnIncreasing,
  scan: ScanSearch,
  arrow: ArrowRight,
  home: Home,
  leaf: Recycle,
  wallet: HandCoins,
  truck: Route,
  spark: Sparkle,
  sparkles: Sparkle,
  check: Check,
  close: X,
  logout: LogOut,
  settings: Settings,
  box: PackageOpen,
  calendar: CalendarClock,
  people: Handshake,
  bell: Bell,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  chevron: ChevronRight,
  camera: Camera,
  image: Image,
  pin: MapPinned,
  scale: Weight,
  trash: Trash2,
  refresh: RefreshCw,
  building: Factory,
  shield: BadgeCheck,
  upload: Upload,
  eye: Eye,
  'eye-off': EyeOff,
  plus: Plus,
  minus: Minus,
  info: Info,
  alert: CircleAlert,
  external: ArrowUpRight
}

const icon = computed(() => icons[props.name as AppIconName] ?? icons.leaf)
const resolvedStroke = computed(() => {
  if (props.strokeWidth != null) return props.strokeWidth
  return props.tone === 'brand' ? 2 : 1.75
})
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="resolvedStroke"
    :class="['app-icon', tone === 'brand' ? 'app-icon--brand' : null, props.class]"
    aria-hidden="true"
  />
</template>

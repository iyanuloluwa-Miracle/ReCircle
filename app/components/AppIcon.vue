<script setup lang="ts">
import type { Component } from 'vue'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Home,
  Image,
  Info,
  LayoutGrid,
  Leaf,
  LogOut,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Scale,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  Users,
  Wallet,
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

const props = withDefaults(defineProps<{
  name: AppIconName | string
  size?: number | string
  strokeWidth?: number | string
  class?: string
}>(), {
  size: 24,
  strokeWidth: 1.75
})

const icons: Record<AppIconName, Component> = {
  overview: LayoutGrid,
  chart: BarChart3,
  scan: ScanLine,
  arrow: ArrowRight,
  home: Home,
  leaf: Leaf,
  wallet: Wallet,
  truck: Truck,
  spark: Sparkles,
  sparkles: Sparkles,
  check: Check,
  close: X,
  logout: LogOut,
  settings: Settings,
  box: Package,
  calendar: Calendar,
  people: Users,
  bell: Bell,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  chevron: ChevronRight,
  camera: Camera,
  image: Image,
  pin: MapPin,
  scale: Scale,
  trash: Trash2,
  refresh: RefreshCw,
  building: Building2,
  shield: ShieldCheck,
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
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :class="['app-icon', props.class]"
    aria-hidden="true"
  />
</template>

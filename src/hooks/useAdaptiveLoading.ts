import { useState, useEffect } from 'react'

interface AdaptiveLoadingConfig {
  // Network quality
  shouldReduceData: boolean // Slow 2G/3G or Save-Data enabled
  shouldLimitImages: boolean // Limit image quality/size
  shouldDisableVideos: boolean // Disable auto-play videos

  // Device capabilities
  isMobile: boolean
  isLowEndDevice: boolean // < 4GB RAM or < 4 CPU cores
  hasSlowCPU: boolean

  // Viewport
  isSmallScreen: boolean // < 768px

  // User preferences
  prefersReducedMotion: boolean
  saveDataEnabled: boolean
}

export function useAdaptiveLoading(): AdaptiveLoadingConfig {
  const [config, setConfig] = useState<AdaptiveLoadingConfig>({
    shouldReduceData: false,
    shouldLimitImages: false,
    shouldDisableVideos: false,
    isMobile: false,
    isLowEndDevice: false,
    hasSlowCPU: false,
    isSmallScreen: false,
    prefersReducedMotion: false,
    saveDataEnabled: false,
  })

  useEffect(() => {
    // Check network conditions
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    const effectiveType = connection?.effectiveType || '4g'
    const saveData = connection?.saveData || false

    // Slow network: 2G or slow-2g
    const isSlowNetwork = effectiveType === 'slow-2g' || effectiveType === '2g'

    // Check device capabilities
    const deviceMemory = (navigator as any).deviceMemory || 8 // GB, default to 8 if not available
    const hardwareConcurrency = navigator.hardwareConcurrency || 4 // CPU cores

    const isLowEndDevice = deviceMemory < 4 || hardwareConcurrency < 4
    const hasSlowCPU = hardwareConcurrency < 4

    // Check viewport
    const isSmallScreen = window.innerWidth < 768
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Check user preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Determine adaptive settings
    const shouldReduceData = isSlowNetwork || saveData
    const shouldLimitImages = shouldReduceData || isLowEndDevice
    const shouldDisableVideos = isSlowNetwork || (isLowEndDevice && saveData)

    setConfig({
      shouldReduceData,
      shouldLimitImages,
      shouldDisableVideos,
      isMobile,
      isLowEndDevice,
      hasSlowCPU,
      isSmallScreen,
      prefersReducedMotion,
      saveDataEnabled: saveData,
    })
  }, [])

  return config
}

// Helper hook for image quality
export function useImageQuality() {
  const { shouldLimitImages, shouldReduceData } = useAdaptiveLoading()

  if (shouldReduceData) return 50 // Very low quality
  if (shouldLimitImages) return 65 // Low quality
  return 85 // Default quality
}

// Helper hook for determining if should lazy load
export function useShouldLazyLoad(priority: 'high' | 'medium' | 'low' = 'medium') {
  const { shouldReduceData, isLowEndDevice } = useAdaptiveLoading()

  // High priority: always load eagerly (e.g., first image in feed)
  if (priority === 'high') return false

  // Medium priority: lazy load on slow networks or low-end devices
  if (priority === 'medium') return shouldReduceData || isLowEndDevice

  // Low priority: always lazy load
  return true
}

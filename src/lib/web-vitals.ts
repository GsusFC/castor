import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

type Metric = {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

function logMetric(metric: Metric) {
  const color = {
    good: '\x1b[32m',       // green
    'needs-improvement': '\x1b[33m', // yellow
    poor: '\x1b[31m',       // red
  }[metric.rating]
  
  console.log(
    `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
    `color: ${color === '\x1b[32m' ? 'green' : color === '\x1b[33m' ? 'orange' : 'red'}`
  )
}

export function initWebVitals() {
  // Largest Contentful Paint - time to render largest element
  onLCP((metric) => logMetric(metric as Metric))
  
  // First Contentful Paint - time to first content
  onFCP((metric) => logMetric(metric as Metric))
  
  // Interaction to Next Paint - responsiveness (replaced FID)
  onINP((metric) => logMetric(metric as Metric))
  
  // Cumulative Layout Shift - visual stability
  onCLS((metric) => logMetric(metric as Metric))
  
  // Time to First Byte - server response time
  onTTFB((metric) => logMetric(metric as Metric))
}

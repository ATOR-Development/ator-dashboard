export const route = useRoute()

export const navItems = ref([
  {
    label: 'Dashboard',
    icon: 'mdi-speedometer',
    to: '/'
  },
  {
    label: 'Distribution',
    icon: 'mdi-network-pos',
    to: '/distribution'
  },
  {
    label: 'My Relays',
    icon: 'mdi-lifebuoy',
    to: '/my-relays'
  },
  {
    label: 'My Tokens',
    icon: 'mdi-bank',
    to: '/my-tokens'
  }
])

export const currentPageTitle = computed(() => {
  const currentNavItem = navItems.value.find(item => {
    if (item.to && route.name === item.to.substring(1)) {
      return true
    }
    
    if (route.name === 'index' && item.to === '/') {
      return true
    }

    return false
  })
    
  return currentNavItem ? currentNavItem.label : ''
})

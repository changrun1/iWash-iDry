import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'

export const useMachineStore = defineStore('machine', () => {
  const machines = ref([])
  const regions = ref([])
  const locations = ref([])
  const onlineRegions = ref(0)
  const loading = ref(false)
  const error = ref(null)

  // Computed properties (getters)
  const availableMachines = computed(() => 
    machines.value.filter(machine => machine.status === 'available')
  )

  const occupiedMachines = computed(() => 
    machines.value.filter(machine => machine.status === 'in_use')
  )

  const maintenanceMachines = computed(() => 
    machines.value.filter(machine => machine.status === 'maintenance')
  )

  const allRegions = computed(() => 
    [...new Set(machines.value.map(machine => machine.region))].filter(Boolean)
  )

  // 改善位置分類邏輯
  const allLocations = computed(() => {
    const locations = machines.value.map(machine => machine.location).filter(Boolean)
    return [...new Set(locations)].sort((a, b) => {
      // 按宿舍和樓層排序
      const aDorm = a.match(/^(\S+)/)?.[1] || ''
      const bDorm = b.match(/^(\S+)/)?.[1] || ''
      if (aDorm !== bDorm) {
        return aDorm.localeCompare(bDorm, 'zh-TW')
      }
      
      // 同宿舍按樓層排序
      const aFloor = parseInt(a.match(/(\d+)樓/)?.[1] || '0')
      const bFloor = parseInt(b.match(/(\d+)樓/)?.[1] || '0')
      return aFloor - bFloor
    })
  })

  // 按宿舍分組的位置
  const locationsByDorm = computed(() => {
    const grouped = {}
    allLocations.value.forEach(location => {
      const dorm = location.match(/^(\S+)/)?.[1] || '其他'
      if (!grouped[dorm]) {
        grouped[dorm] = []
      }
      grouped[dorm].push(location)
    })
    
    // 按宿舍名稱排序
    const sortedGrouped = {}
    const dormOrder = ['勤軒', '樸軒', '華軒', '誠軒']
    
    // 先加入已知順序的宿舍
    dormOrder.forEach(dorm => {
      if (grouped[dorm]) {
        sortedGrouped[dorm] = grouped[dorm].sort((a, b) => {
          const aFloor = parseInt(a.match(/(\d+)樓/)?.[1] || '0')
          const bFloor = parseInt(b.match(/(\d+)樓/)?.[1] || '0')
          return aFloor - bFloor
        })
      }
    })
    
    // 加入其他宿舍
    Object.keys(grouped).forEach(dorm => {
      if (!dormOrder.includes(dorm)) {
        sortedGrouped[dorm] = grouped[dorm]
      }
    })
    
    return sortedGrouped
  })

  // 簡化的位置名稱顯示
  const getSimpleLocationName = (fullLocation, dorm) => {
    return fullLocation.replace(dorm, '').trim()
  }

  // 根據選中區域獲取對應的位置列表
  const getLocationsByRegion = (selectedRegion) => {
    if (!selectedRegion) {
      return allLocations.value
    }
    
    return machines.value
      .filter(machine => machine.region === selectedRegion)
      .map(machine => machine.location)
      .filter((location, index, arr) => arr.indexOf(location) === index) // 去重
      .sort((a, b) => {
        const aFloor = parseInt(a.match(/(\d+)樓/)?.[1] || '0')
        const bFloor = parseInt(b.match(/(\d+)樓/)?.[1] || '0')
        return aFloor - bFloor
      })
  }

  // Actions
  const fetchMachines = async (filters = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/machine/status', { params: filters })
      machines.value = response.data.machines || []
      regions.value = response.data.regions || []
      onlineRegions.value = response.data.online_regions || 0
      
      // 更新位置列表（從實際機器資料中提取）
      locations.value = allLocations.value
      
      return response.data
    } catch (error) {
      error.value = error.message
      console.error('Error fetching machines:', error)
      // 如果沒有硬體控制器在線，清空機器列表
      machines.value = []
      regions.value = []
      onlineRegions.value = 0
      locations.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchOnlineMachines = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/hardware/online-machines')
      machines.value = response.data.machines || []
      regions.value = response.data.regions || []
      onlineRegions.value = response.data.online_regions || 0
      
      // 更新位置列表
      locations.value = allLocations.value
      
      return response.data
    } catch (error) {
      error.value = error.message
      console.error('Error fetching online machines:', error)
      // 如果沒有硬體控制器在線，清空機器列表
      machines.value = []
      regions.value = []
      onlineRegions.value = 0
      locations.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchLocations = async () => {
    try {
      // 從機器資料中動態提取位置
      if (machines.value.length === 0) {
        await fetchMachines()
      }
      // locations 已在 fetchMachines 中更新
      return { locations: locations.value }
    } catch (error) {
      console.error('Error fetching locations:', error)
      throw error
    }
  }

  const getMachineById = (id) => {
    return machines.value.find(machine => machine.id === id)
  }

  const getMachinesByLocation = (location) => {
    return machines.value.filter(machine => machine.location === location)
  }

  const getMachinesByRegion = (region) => {
    return machines.value.filter(machine => machine.region === region)
  }

  const getAvailableMachines = (machineType = null) => {
    return machines.value.filter(machine => {
      const isAvailable = machine.status === 'available'
      const matchesType = !machineType || machine.machine_type === machineType
      return isAvailable && matchesType
    })
  }

  const updateMachineStatus = async (machineId, status) => {
    try {
      await api.put(`/machine/${machineId}/status`, { status })
      await fetchMachines() // 重新獲取資料
    } catch (error) {
      console.error('Error updating machine status:', error)
      throw error
    }
  }

  const startMachine = async (machineId) => {
    try {
      const response = await api.post(`/machine/${machineId}/start`)
      // 重新獲取機器狀態
      await fetchMachines()
      return response.data
    } catch (error) {
      throw error
    }
  }

  // 清除所有資料（當沒有硬體控制器時）
  const clearMachines = () => {
    machines.value = []
    regions.value = []
    locations.value = []
    onlineRegions.value = 0
  }

  return {
    // State
    machines,
    regions,
    locations,
    onlineRegions,
    loading,
    error,
    
    // Getters
    availableMachines,
    occupiedMachines,
    maintenanceMachines,
    allRegions,
    allLocations,
    locationsByDorm,
    
    // Helpers
    getSimpleLocationName,
    getLocationsByRegion,
    
    // Actions
    fetchMachines,
    fetchOnlineMachines,
    fetchLocations,
    getMachineById,
    getMachinesByLocation,
    getMachinesByRegion,
    getAvailableMachines,
    updateMachineStatus,
    startMachine,
    clearMachines
  }
})

export type Cuisine = {
  id: number
  name: string
}

const API_BASE_URL = "/api"

export async function getCuisines(): Promise<Cuisine[]> {
  const url = `${API_BASE_URL}/cuisines`
  console.log('Fetching cuisines from:', url)
  
  try {
    const response = await fetch(url)
    console.log('Cuisines fetch response status:', response.status)
    
    if (!response.ok) {
      throw new Error(`Cuisine request failed: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Fetched cuisines:', data.length, 'items')
    return data
  } catch (error) {
    console.error('Error fetching cuisines:', error)
    throw error
  }
}
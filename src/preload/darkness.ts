import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'

// Preload the Darkness GLTF and its dependent assets at app startup
// so navigation to the Projects route feels instant.
const files = import.meta.glob('../assets/darkness/**/*', { as: 'url', eager: true }) as Record<string, string>
const baseKey = '../assets/darkness/'
const toUrl = (rel: string) => files[baseKey + rel] ?? rel

// Kick off a preload of the main GLTF file
useLoader.preload(GLTFLoader, toUrl('scene.gltf'))

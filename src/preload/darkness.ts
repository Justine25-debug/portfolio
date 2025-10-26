import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Preload the Darkness GLTF and its dependent assets at app startup
// so navigation to the Projects route feels instant.
const files = import.meta.glob('../assets/darkness/**/*', { as: 'url', eager: true }) as Record<string, string>
const baseKey = '../assets/darkness/'
const toUrl = (rel: string) => files[baseKey + rel] ?? rel

// Manually preload using GLTFLoader with the same URL rewrite logic used in runtime
try {
	const mapDependentUrl = (raw: string) => {
		try {
			const u = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
			const path = u.pathname.replace(/\\/g, '/')
			const m = path.match(/(?:^|\/)(scene\.bin|textures\/[^/]+)$/i)
			if (m && m[1]) {
				const mapped = toUrl(m[1])
				if (mapped) return mapped
			}
		} catch {
			const rel = raw.replace(/^\.?\//, '')
			const mapped = toUrl(rel)
			if (mapped) return mapped
		}
		return raw
	}

	const loader = new GLTFLoader()
	loader.manager.setURLModifier((url) => mapDependentUrl(url))
	// Fire and forget the preload; ignore errors to avoid blocking app startup
	loader.load(toUrl('scene.gltf'), () => {}, undefined, () => {})
} catch {
	// Non-fatal: if preloading fails for any reason, runtime load will still attempt
}

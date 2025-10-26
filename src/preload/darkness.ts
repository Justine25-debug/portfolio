import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Preload Darkness GLTF + assets for faster first render.
const files = import.meta.glob('../assets/darkness/**/*', { as: 'url', eager: true }) as Record<string, string>
const baseKey = '../assets/darkness/'
const toUrl = (rel: string) => files[baseKey + rel] ?? rel

// GLTFLoader with URL rewrite to emitted asset URLs.
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
	// Best-effort preload; ignore errors.
	loader.load(toUrl('scene.gltf'), () => {}, undefined, () => {})
} catch {
	// Ignore preload errors.
}

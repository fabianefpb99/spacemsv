import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/gen-applause')({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.ELEVENLABS_API_KEY
        if (!apiKey) return new Response('no key', { status: 500 })
        const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Distant, refined, elegant polite applause from a small upscale theater audience, soft clapping at a classy black-tie event, recorded from far away, ambient, gentle, warm, no cheering, no whistles, no voices, sophisticated crowd',
            duration_seconds: 6,
            prompt_influence: 0.5,
          }),
        })
        if (!res.ok) return new Response(await res.text(), { status: res.status })
        const buf = await res.arrayBuffer()
        return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg' } })
      },
    },
  },
})
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Brighter blue palette instead of the near-black slate (used by every bg-/text-/border-slate-* class)
                slate: { 50: '#f5f9ff', 100: '#e8f0ff', 200: '#d3e2fb', 300: '#b4caee', 400: '#9db8e6', 500: '#7f9bd0', 600: '#5878b8', 700: '#43649f', 800: '#345490', 900: '#284282', 950: '#1c3369' },
                gold: { 400: '#facc15', 500: '#eab308', 600: '#ca8a04' },
                emerald: { 400: '#34d399', 500: '#10b981', 600: '#059669' },
                navy: { 800: '#0f172a', 900: '#020617' }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Space Grotesk', 'sans-serif']
            }
        }
    }
}

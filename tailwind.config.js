/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
      './pages/**/*.{js,jsx}',
      './components/**/*.{js,jsx}',
      './app/**/*.{js,jsx}',
      './src/**/*.{js,jsx}',
    ],
    prefix: "",
    theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		fontFamily: {
    			sans: ['Inter', 'system-ui', 'sans-serif'],
    			heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
    			'display': ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
    		},
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))',
    				50: '#f0f4ff',
    				100: '#e0e8ff',
    				200: '#c1d1ff',
    				300: '#a3baff',
    				400: '#859aff',
    				500: '#6b7cff',
    				600: '#5563f0',
    				700: '#4149d6',
    				800: '#2d33ad',
    				900: '#1f2383',
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))',
    				50: '#f5f3ff',
    				100: '#ede8ff',
    				200: '#ddd3ff',
    				300: '#cdbfff',
    				400: '#b8a3ff',
    				500: '#9d7fff',
    				600: '#8055ff',
    				700: '#6b3acc',
    				800: '#502399',
    				900: '#350f66',
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))',
    				50: '#f0fdf4',
    				100: '#dcfce7',
    				200: '#bbf7d0',
    				300: '#86efac',
    				400: '#4ade80',
    				500: '#22c55e',
    				600: '#16a34a',
    				700: '#15803d',
    				800: '#166534',
    				900: '#145231',
    			},
    			success: {
    				DEFAULT: '#10b981',
    				light: '#d1fae5',
    				dark: '#047857',
    			},
    			warning: {
    				DEFAULT: '#f59e0b',
    				light: '#fef3c7',
    				dark: '#d97706',
    			},
    			danger: {
    				DEFAULT: '#ef4444',
    				light: '#fee2e2',
    				dark: '#dc2626',
    			},
    			info: {
    				DEFAULT: '#3b82f6',
    				light: '#dbeafe',
    				dark: '#1d4ed8',
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)',
    			'xl': '1rem',
    			'2xl': '1.5rem',
    			'3xl': '2rem',
    		},
    		boxShadow: {
    			'soft': '0 2px 4px rgba(0, 0, 0, 0.05)',
    			'medium': '0 4px 12px rgba(0, 0, 0, 0.1)',
    			'lg': '0 10px 28px rgba(0, 0, 0, 0.15)',
    			'xl': '0 20px 40px rgba(0, 0, 0, 0.2)',
    			'glow': '0 0 30px rgba(107, 124, 255, 0.3)',
    			'glow-accent': '0 0 30px rgba(34, 197, 94, 0.3)',
    		},
    		backdropBlur: {
    			xs: '2px',
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			'fadeIn': {
    				from: { opacity: '0' },
    				to: { opacity: '1' }
    			},
    			'slideUp': {
    				from: {
    					opacity: '0',
    					transform: 'translateY(10px)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'slideDown': {
    				from: {
    					opacity: '0',
    					transform: 'translateY(-10px)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'scaleIn': {
    				from: {
    					opacity: '0',
    					transform: 'scale(0.95)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'scale(1)'
    				}
    			},
    			'pulse-glow': {
    				'0%, 100%': { opacity: '1' },
    				'50%': { opacity: '.8' }
    			},
    			'shimmer': {
    				'0%': { backgroundPosition: '-1000px 0' },
    				'100%': { backgroundPosition: '1000px 0' }
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'fadeIn': 'fadeIn 0.3s ease-out',
    			'slideUp': 'slideUp 0.3s ease-out',
    			'slideDown': 'slideDown 0.3s ease-out',
    			'scaleIn': 'scaleIn 0.3s ease-out',
    			'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    			'shimmer': 'shimmer 2s infinite',
    		}
    	}
    },
    plugins: [require("tailwindcss-animate")],
  }
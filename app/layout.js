import './globals.css';

export const metadata = {
  title: 'CareerGPT - AI-Powered Career Guidance Platform',
  description: 'Get AI-driven career guidance, resume analysis, mock interviews, and personalized career path recommendations. Powered by advanced AI models.',
  keywords: 'career, AI, guidance, resume, interview, career path, job matching',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Custom Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" 
          rel="stylesheet" 
        />
        
        {/* Smooth scroll */}
        <style>{`
          html {
            scroll-behavior: smooth;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
        `}</style>
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

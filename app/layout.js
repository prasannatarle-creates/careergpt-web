import './globals.css';

export const metadata = {
  title: 'CareerGPT - AI-Powered Career Guidance',
  description: 'Get AI-driven career guidance, resume analysis, mock interviews, and personalized career path recommendations.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: 'Inter, sans-serif' }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

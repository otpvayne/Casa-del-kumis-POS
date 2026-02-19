import "./globals.css";

export const metadata = {
  title: "Casa del Kumis POS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="page">
          {children}
        </div>
      </body>
    </html>
  );
}

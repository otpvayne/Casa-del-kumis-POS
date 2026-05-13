import "./globals.css";
import { PlantProvider } from "@/contexts/PlantContext";

export const metadata = {
  title: "Casa del Kumis POS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <PlantProvider>
          <div className="page">
            {children}
          </div>
        </PlantProvider>
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Історія в картках",
    short_name: "Історія",
    description:
      "Українська хронологічна гра: розстав події, людей і місця України в правильному порядку.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#060607",
    theme_color: "#060607",
    lang: "uk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

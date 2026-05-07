import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saily CRM",
    short_name: "Saily",
    description: "Offline-capable CRM workspace",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      {
        src: "/images/opengraph-image.png",
        sizes: "1200x630",
        type: "image/png",
      },
    ],
  };
}

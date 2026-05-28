import { useEffect } from "react";
import { captureFbclid, trackPageView } from "@/lib/meta-pixel";

interface TrackingScriptsProps {
  metaPixelId?: string | null;
  gtmContainerId?: string | null;
  gaMeasurementId?: string | null;
  restaurantId?: string;
}

export function TrackingScripts({ metaPixelId, gtmContainerId, gaMeasurementId, restaurantId }: TrackingScriptsProps) {
  // Capture fbclid from URL on mount (before pixel loads)
  useEffect(() => {
    captureFbclid();
  }, []);

  useEffect(() => {
    const scripts: HTMLScriptElement[] = [];
    const noscripts: HTMLElement[] = [];

    // Meta Pixel
    if (metaPixelId) {
      const pixelScript = document.createElement("script");
      pixelScript.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${metaPixelId}');
      `;
      document.head.appendChild(pixelScript);
      scripts.push(pixelScript);

      const noscript = document.createElement("noscript");
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.src = `https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`;
      noscript.appendChild(img);
      document.body.appendChild(noscript);
      noscripts.push(noscript);

      // Fire PageView with dual tracking (browser + CAPI) after pixel is ready
      setTimeout(() => {
        trackPageView(restaurantId);
      }, 500);
    }

    // Google Tag Manager
    if (gtmContainerId) {
      const gtmScript = document.createElement("script");
      gtmScript.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmContainerId}');
      `;
      document.head.appendChild(gtmScript);
      scripts.push(gtmScript);

      const gtmNoscript = document.createElement("noscript");
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmContainerId}`;
      iframe.height = "0";
      iframe.width = "0";
      iframe.style.display = "none";
      iframe.style.visibility = "hidden";
      gtmNoscript.appendChild(iframe);
      document.body.appendChild(gtmNoscript);
      noscripts.push(gtmNoscript);
    }

    // Google Analytics 4
    if (gaMeasurementId) {
      const gaScript = document.createElement("script");
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
      document.head.appendChild(gaScript);
      scripts.push(gaScript);

      const gaConfigScript = document.createElement("script");
      gaConfigScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaMeasurementId}');
      `;
      document.head.appendChild(gaConfigScript);
      scripts.push(gaConfigScript);
    }

    return () => {
      scripts.forEach((s) => s.remove());
      noscripts.forEach((n) => n.remove());
    };
  }, [metaPixelId, gtmContainerId, gaMeasurementId, restaurantId]);

  return null;
}

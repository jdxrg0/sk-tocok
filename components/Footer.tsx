import { MapPin, Mail, Phone, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 pt-5 pb-24 md:py-5 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-brand-600/60 dark:border-brand-500/70 overflow-hidden bg-[#ffffff] shadow-xs shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sk-logo.jpg"
                alt="Sangguniang Kabataan Barangay Tocok Official Seal"
                className="w-full h-full object-cover scale-[1.05]"
              />
            </div>
            <div className="leading-tight">
              <span className="font-black text-sm tracking-tight block">
                <span className="text-brand-600 dark:text-brand-400">Sangguniang</span>{" "}
                <span className="text-brand-800 dark:text-brand-200">Kabataan</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block">
                Barangay Tocok
              </span>
            </div>
          </div>

          {/* Inquiries */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Barangay Tocok Hall, San Fabian</span>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>sktocok.youth@gmail.com</span>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>+63 912 345 6789</span>
            </span>
          </div>
        </div>

        {/* Bottom Bar: Copyright */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400 dark:text-slate-500 text-[11px]">
          <span>&copy; {new Date().getFullYear()} Sangguniang Kabataan ng Barangay Tocok. All rights reserved.</span>
          <span className="flex items-center gap-1">
            Built for Tocok Youth with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </span>
        </div>
      </div>
    </footer>
  );
}

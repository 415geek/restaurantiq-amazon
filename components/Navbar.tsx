"use client";

import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Abstract i/Q Logo */}
          <div className="relative w-10 h-10">
            {/* Outer circle (Q) */}
            <div 
              className="absolute inset-0 rounded-full border-2 border-[#F26A36]"
              style={{ boxShadow: "0 0 12px rgba(242, 106, 54, 0.4)" }}
            />
            {/* Inner dot (i) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#F26A36]" />
            </div>
            {/* Small tail for Q */}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#F26A36] rounded-full" />
          </div>
          
          {/* Text Logo */}
          <div className="text-xl font-semibold tracking-tight">
            <span className="text-white">Restaurant</span>
            <span className="text-[#F26A36] ml-1">IQ</span>
          </div>
        </motion.div>

        {/* Navigation Links */}
        <motion.div
          className="flex items-center gap-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            Dashboard
          </a>
          <a href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">
            Analytics
          </a>
          <a href="/settings" className="text-sm text-gray-400 hover:text-white transition-colors">
            Settings
          </a>
          <a href="/account" className="px-4 py-2 text-sm font-medium text-white bg-[#F26A36] rounded-xl hover:bg-[#F26A36]/90 transition-colors">
            Account
          </a>
        </motion.div>
      </div>
    </nav>
  );
}

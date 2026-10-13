"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function PresentationDashboard() {
  const [activeTab, setActiveTab] = useState("flyer");

  return (
    <div className="min-h-screen pb-12 font-sans w-full">
      
      {/* 1. ENG TEPADA - PROMO BAR (Tayyor ish) */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 py-3 text-white text-center relative z-50 shadow-md w-full">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 max-w-7xl mx-auto">
          <span className="flex items-center gap-2 font-medium text-sm">
            <span className="text-xl animate-bounce">🎉</span>
            <strong className="font-bold text-yellow-300">YANGI AKSIYA:</strong> 
            15-oktyabrgacha ro'yxatdan o'ting va yil oxirigacha 0% komissiya bilan ishlang!
          </span>
          <button className="bg-white/20 hover:bg-white/30 text-white border border-white/40 rounded-full px-4 py-1 text-xs font-bold transition-colors backdrop-blur-sm">
            Batafsil &rarr;
          </button>
        </div>
      </div>

      {/* HEADER - PREZENTATSIYA NOMI */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-6 mb-8 w-full">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <p className="text-blue-600 font-bold text-sm tracking-widest uppercase mb-1">Farrux - B2B Bo'limi</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">SAFAAR.uz B2B Hisoboti</h1>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">Startap Demo Day (Oktyabr 2026) uchun barcha tayyor materiallar integratsiyasi.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">3 Oylik Maqsad (31-Dekabrgacha)</p>
            <div className="flex gap-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex flex-col items-center">
                <span className="block text-2xl font-black text-blue-700">50</span>
                <span className="text-[10px] sm:text-xs text-blue-600 font-bold uppercase tracking-wider">Mehmonxona</span>
              </div>
              <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex flex-col items-center">
                <span className="block text-2xl font-black text-orange-700">40</span>
                <span className="text-[10px] sm:text-xs text-orange-600 font-bold uppercase tracking-wider">Restoran</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ASOSIY QISM - TABLAR BOSHQRUVI */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 w-full">
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 border-b border-slate-200 pb-px">
          {["flyer", "rassilka", "instagram"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-bold text-xs sm:text-sm uppercase tracking-wide rounded-t-xl transition-all ${
                activeTab === tab 
                ? "bg-white text-blue-600 border-t border-l border-r border-slate-200 -mb-px" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab === "flyer" && "1. Raqamli Flayer"}
              {tab === "rassilka" && "2. Rassilka Tizimi"}
              {tab === "instagram" && "3. Instagram B2B Reja"}
            </button>
          ))}
        </div>

        {/* TAB 1: RAQAMLI FLAYER PREVIEW */}
        {activeTab === "flyer" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8 flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Raqamli Flayer (Landing Page)</h2>
              <p className="text-slate-600 mb-6 leading-relaxed text-sm sm:text-base">
                Men oddiy qog'oz flayer qilish o'rniga, mehmonxonalar uchun to'g'ridan-to'g'ri tizimga ulanadigan, chiroyli dizayndagi <b>Interaktiv Flayer</b> yasadim. Ular havolani telefonlarida ochib, darhol platformaga a'zo bo'lishlari mumkin.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-slate-700 text-sm sm:text-base"><span className="text-green-500 font-bold">✓</span> Mobile-first dizayn (Tailwind CSS)</li>
                <li className="flex items-center gap-2 text-slate-700 text-sm sm:text-base"><span className="text-green-500 font-bold">✓</span> Registratsiyaga to'g'ridan-to'g'ri havola</li>
                <li className="flex items-center gap-2 text-slate-700 text-sm sm:text-base"><span className="text-green-500 font-bold">✓</span> Safaar loyihasiga to'liq integratsiya qilingan</li>
              </ul>
              
              <Link href="/promo" target="_blank" className="inline-block bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Flayerni to'liq ochib ko'rish &rarr;
              </Link>
            </div>
            {/* Flayer Mini-Preview (Telefon shakli) */}
            <div className="hidden sm:flex w-[280px] h-[480px] bg-slate-900 rounded-[30px] p-2 border-4 border-slate-300 shadow-2xl relative overflow-hidden flex-shrink-0 mx-auto">
               <div className="w-full h-full bg-slate-50 rounded-[22px] overflow-hidden flex flex-col">
                 <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-4 text-center rounded-b-2xl">
                    <h3 className="text-xl font-black text-white">SAFAAR.uz</h3>
                 </div>
                 <div className="p-4 flex-1 flex flex-col mt-2">
                    <p className="font-extrabold text-slate-800 text-center mb-4 text-lg leading-tight">Daromadingizni oshirishga tayyormisiz?</p>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl mb-3 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-blue-500 text-base">📈</span> Yangi mijozlar oqimi
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl mb-3 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-green-500 text-base">💻</span> Qulay Hamkor Kabineti
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl mb-6 shadow-sm text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-purple-500 text-base">💳</span> 100% Onlayn To'lovlar
                    </div>
                    <div className="mt-auto bg-blue-600 text-white text-center py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30">
                      HAMKOR BO'LISH
                    </div>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* TAB 2: RASSILKA TIZIMI */}
        {activeTab === "rassilka" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-8 border-b border-slate-100">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Platforma Ichidagi Rassilka (Mass Mailer)</h2>
              <p className="text-slate-600 text-sm sm:text-base">Mailchimp kabi xizmatlarga pul to'lamaslik uchun, to'g'ridan-to'g'ri admin panelda ishlaydigan Rassilka yuborish mexanizmini yasadim.</p>
            </div>
            {/* Rassilka UIning kichraytirilgan maketi */}
            <div className="bg-slate-50 p-4 sm:p-8">
               <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  
                  <label className="block text-sm font-bold text-slate-700 mb-2">Xat Mavzusi (Subject)</label>
                  <input disabled type="text" value="SAFAAR.uz: Biznesingiz daromadini oshiring!" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 font-medium mb-5 opacity-80" />

                  <label className="block text-sm font-bold text-slate-700 mb-2">Qabul qiluvchilar E-mail manzillari</label>
                  <textarea disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-500 font-mono mb-5 opacity-80" rows={4}>hotel@tashkent.uz&#10;info@smarqand.uz&#10;manager@bukhara-hotel.uz</textarea>
                  
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tayyor HTML Shablon</label>
                  <select disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 font-medium mb-6 opacity-80">
                    <option>B2B Mehmonxonalar uchun (0% komissiya)</option>
                  </select>
                  
                  <button disabled className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl w-full flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-not-allowed">
                    <span>🚀</span> 50 ta Mehmonxonaga Xat Jo'natish
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-3 flex justify-center items-center gap-1">
                     <span className="text-green-500">✓</span> Backend API ulangach to'liq ishga tushadi
                  </p>
               </div>
            </div>
          </div>
        )}

        {/* TAB 3: INSTAGRAM REJA */}
        {activeTab === "instagram" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">Instagram B2B Strategiyasi (Saidkarim & Farrux)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <span className="text-pink-500">📅</span> 1 Oylik Kontent Plan
                </h3>
                <ul className="space-y-3">
                  <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                    <div className="bg-blue-100 text-blue-600 font-bold rounded-lg w-10 h-10 flex items-center justify-center shrink-0">1</div>
                    <p className="text-sm text-slate-700"><strong className="text-slate-900 block mb-1">Tanishtiruv:</strong> Nega eng oldi mehmonxonalar Safaar'ga qo'shilmoqda?</p>
                  </li>
                  <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                    <div className="bg-blue-100 text-blue-600 font-bold rounded-lg w-10 h-10 flex items-center justify-center shrink-0">2</div>
                    <p className="text-sm text-slate-700"><strong className="text-slate-900 block mb-1">Mehmonxona fokusi:</strong> Bo'sh xonalarni qanday qilib tez to'ldirish siri.</p>
                  </li>
                  <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                    <div className="bg-blue-100 text-blue-600 font-bold rounded-lg w-10 h-10 flex items-center justify-center shrink-0">3</div>
                    <p className="text-sm text-slate-700"><strong className="text-slate-900 block mb-1">Restoran fokusi:</strong> Restoraningizga sayyohlarni qanday olib kelamiz?</p>
                  </li>
                  <li className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                    <div className="bg-blue-100 text-blue-600 font-bold rounded-lg w-10 h-10 flex items-center justify-center shrink-0">4</div>
                    <p className="text-sm text-slate-700"><strong className="text-slate-900 block mb-1">Maxsulot Demosi:</strong> Safaar Hamkor Kabineti qanday ishlaydi?</p>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-bold text-slate-800 text-lg mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <span className="text-pink-500">📝</span> 1-Postning Tayyor Matni
                </h3>
                <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-inner">
                  <strong className="text-white block mb-2">Mehmonxona, dacha yoki restoran egasimisiz?</strong>
                  Bo'sh xonalar va stollar sonini kamaytirib, daromadingizni oshirmoqchimisiz? 📈
                  {"\n\n"}Sizni O'zbekistonning eng yangi turar joy ekotizimi — SAFAAR.uz ga taklif qilamiz!
                  {"\n\n"}✅ To'g'ridan-to'g'ri auditoriya
                  {"\n"}✅ Qulay "Hamkor Kabineti"
                  {"\n"}✅ Click, Payme kafolatlangan to'lov
                  {"\n\n"}Va eng asosiysi — ulanish hozirda mutlaqo BEPUL! 
                  Hamkorlikni boshlash uchun Direct'ga yozing. 👇
                  {"\n\n"}#safaaruz #b2buzbekistan #mehmonxona
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

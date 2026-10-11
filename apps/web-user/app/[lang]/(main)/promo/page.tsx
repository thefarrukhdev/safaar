import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PromoShinyText } from "@/components/ui/PromoShinyText";
import { Hotel, Utensils, TrendingUp, Users, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner with Safaar | Hotels & Restaurants",
  description: "Join the Safaar platform to connect with premium guests, increase revenue, and manage bookings effortlessly.",
};

export default function PromoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 w-full overflow-hidden">
      {/* Urgency Banner */}
      <div className="bg-primary px-4 py-3 text-center text-sm font-medium text-white flex items-center justify-center gap-2 shadow-sm">
        <Clock className="w-4 h-4 animate-pulse" />
        <span>Limited time offer: Join now and enjoy 0% commission for the first 30 days!</span>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex flex-col items-center">
        {/* Hero Section */}
        <section className="text-center w-full max-w-4xl mx-auto mb-20 md:mb-28">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-100/60 border border-blue-200/60 text-blue-800 text-sm font-semibold tracking-wide uppercase shadow-sm">
            <span>For Hotels & Restaurants</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-tight">
            Elevate Your Business with <span className="inline-block"><PromoShinyText className="text-primary">Safaar</PromoShinyText></span>
          </h1>
          <p className="text-lg md:text-2xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto">
            Join the leading platform connecting premium guests with top-tier hospitality. Increase your revenue, manage bookings effortlessly, and grow your brand.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://partner.safaar.uz/register" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-lg px-10 py-7 shadow-lg hover:shadow-xl transition-shadow rounded-full">
                Become a Partner <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-4">Registration takes less than 2 minutes. No credit card required.</p>
        </section>

        {/* Value Propositions */}
        <section className="w-full mb-24 md:mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Partner with Us?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">We provide the tools and exposure you need to take your hospitality business to the next level.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-8 flex flex-col items-start hover:shadow-xl transition-all duration-300 border-slate-200 hover:-translate-y-1 bg-white">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Increase Revenue</h3>
              <p className="text-slate-600 leading-relaxed">Tap into our massive user base of verified travelers and food enthusiasts looking for premium experiences.</p>
            </Card>

            <Card className="p-8 flex flex-col items-start hover:shadow-xl transition-all duration-300 border-slate-200 hover:-translate-y-1 bg-white">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Reach More Guests</h3>
              <p className="text-slate-600 leading-relaxed">Gain immediate exposure to thousands of daily active users specifically searching in your area.</p>
            </Card>

            <Card className="p-8 flex flex-col items-start hover:shadow-xl transition-all duration-300 border-slate-200 hover:-translate-y-1 bg-white">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 shadow-sm border border-purple-100">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Secure Bookings</h3>
              <p className="text-slate-600 leading-relaxed">Enjoy guaranteed payments and reduced no-shows with our secure and reliable booking system.</p>
            </Card>

            <Card className="p-8 flex flex-col items-start hover:shadow-xl transition-all duration-300 border-slate-200 hover:-translate-y-1 bg-white">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6 shadow-sm border border-orange-100">
                <Utensils className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Easy Management</h3>
              <p className="text-slate-600 leading-relaxed">Our state-of-the-art partner dashboard makes managing inventory, menus, and bookings a breeze.</p>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full max-w-5xl mx-auto rounded-[2.5rem] bg-slate-900 text-white p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-primary/30 blur-[80px]"></div>
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 rounded-full bg-purple-500/20 blur-[80px]"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Ready to grow your business?</h2>
            <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of successful hotels and restaurants already thriving on Safaar. Experience the difference today.
            </p>
            <Link href="https://partner.safaar.uz/register" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 gap-2 px-10 py-7 text-lg font-bold rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                Start Your Free Trial <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

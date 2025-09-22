import { ArrowRight, CheckCircle, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import logo from "@/public/flexile-logo.svg";
import { cn } from "@/utils";
import iconClock from "./icon-clock.svg";
import iconEye from "./icon-eye.svg";
import iconGlobe from "./icon-globe.svg";
const Section = ({ children, className, id }: { children: ReactNode; className?: string; id?: string }) => (
  <section id={id} className={cn("flex", className)}>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 md:gap-12">{children}</div>
  </section>
);

const FeatureCard = ({ icon, title, description }: { icon: ReactNode; title: string; description: string }) => (
  <div className="flex flex-col items-center rounded-lg border border-gray-100 bg-white p-6 text-center transition-shadow hover:shadow-lg">
    <div className="mb-4 rounded-full bg-blue-50 p-3">{icon}</div>
    <h3 className="mb-2 text-xl font-semibold">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

const StepCard = ({ step, title, description }: { step: number; title: string; description: string }) => (
  <div className="flex flex-col items-center text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
      {step}
    </div>
    <h3 className="mb-2 text-xl font-semibold">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

const TestimonialCard = ({ quote, name, role }: { quote: string; name: string; role: string }) => (
  <div className="rounded-lg border border-gray-100 bg-white p-6">
    <div className="mb-4 flex items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <CheckCircle key={i} className="mr-1 h-5 w-5 text-green-500" />
      ))}
    </div>
    <p className="mb-4 text-gray-600">{quote}</p>
    <div className="font-semibold">{name}</div>
    <div className="text-sm text-gray-500">{role}</div>
  </div>
);

const IntegrationBadge = ({ name }: { name: string }) => (
  <div className="rounded-lg bg-gray-100 px-6 py-3 font-semibold">{name}</div>
);

const FeatureListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex items-center">
    <CheckCircle className="mr-3 h-6 w-6 flex-shrink-0 text-green-400" />
    <span className="text-lg">{children}</span>
  </li>
);

const PricingExample = ({ amount, cost }: { amount: string; cost: string }) => (
  <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
    <span>{amount}</span>
    <span className="font-semibold text-green-300">{cost}</span>
  </div>
);

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center">
            <Image src={logo} alt="Flexile" className="h-8 w-auto" priority />
          </Link>
          <div className="hidden items-center space-x-8 md:flex">
            <a href="#features" className="scroll-smooth text-gray-600 transition-colors hover:text-gray-900">
              Features
            </a>
            <a href="#how-it-works" className="scroll-smooth text-gray-600 transition-colors hover:text-gray-900">
              How it works
            </a>
            <a href="#pricing" className="scroll-smooth text-gray-600 transition-colors hover:text-gray-900">
              Pricing
            </a>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-white pt-20">
        {/* Hero Section */}
        <Section className="py-16 md:py-24">
          <div className="text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 md:text-7xl">
              Simplifying Contractor
              <span className="block text-blue-600">Payments</span>
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-xl text-gray-600 md:text-2xl">
              Create invoices, get paid faster, and manage everything in one place. The modern platform for contractor
              payments and invoicing.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="default" variant="primary" className="px-8 py-3 text-lg" asChild>
                <Link href="/signup">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="default" variant="outline" className="px-8 py-3 text-lg" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </Section>

        {/* Features Overview */}
        <Section id="features" className="bg-gray-50 py-16">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
              Everything you need to manage contractors
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              Powerful features designed to streamline your contractor payments and invoicing workflow
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Image src={iconClock} alt="" className="h-8 w-8" />}
              title="Send & Track Invoices"
              description="Create professional invoices and track their status in real-time"
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-blue-600" />}
              title="Get Paid Securely"
              description="Secure payment processing with multiple payment methods supported"
            />
            <FeatureCard
              icon={<Image src={iconEye} alt="" className="h-8 w-8" />}
              title="Clear Payment History"
              description="Complete transparency with detailed payment history and reporting"
            />
            <FeatureCard
              icon={<Image src={iconGlobe} alt="" className="h-8 w-8" />}
              title="Global Contractor Support"
              description="Pay contractors worldwide with support for 190+ countries"
            />
          </div>
        </Section>

        {/* How It Works */}
        <Section id="how-it-works" className="py-16">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">How it works</h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              Get started in minutes with our simple three-step process
            </p>
          </div>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <StepCard
              step={1}
              title="Create Invoice"
              description="Set up your contractor details and create professional invoices with our intuitive interface"
            />
            <StepCard
              step={2}
              title="Send & Approve"
              description="Send invoices for approval and track their progress through your workflow"
            />
            <StepCard
              step={3}
              title="Get Paid"
              description="Receive secure payments directly to your account with full transparency"
            />
          </div>
        </Section>

        {/* Testimonials */}
        <Section className="bg-gray-50 py-16">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">Trusted by contractors worldwide</h2>
            <p className="text-xl text-gray-600">Join thousands of contractors and companies using Flexile</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <TestimonialCard
              quote="Flexile has completely streamlined our contractor payment process. What used to take hours now takes minutes."
              name="Sarah Chen"
              role="Startup Founder"
            />
            <TestimonialCard
              quote="The transparency and ease of use is incredible. I can track all my payments and invoices in one place."
              name="Marcus Rodriguez"
              role="Freelance Developer"
            />
            <TestimonialCard
              quote="Global payments made simple. We can now pay our international contractors without any hassle."
              name="Emily Watson"
              role="Operations Manager"
            />
          </div>
        </Section>

        {/* Integrations */}
        <Section className="py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Seamlessly connected with the tools you use
            </h2>
            <p className="text-lg text-gray-600">Integrates with popular payment platforms and business tools</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            <IntegrationBadge name="Stripe" />
            <IntegrationBadge name="Wise" />
            <IntegrationBadge name="PayPal" />
            <IntegrationBadge name="QuickBooks" />
          </div>
        </Section>

        {/* Pricing */}
        <Section id="pricing" className="bg-gradient-to-br from-gray-900 to-blue-900 py-16 text-white">
          <div className="mb-16 text-center">
            <h2 className="mb-6 text-4xl font-bold md:text-5xl">Fair pricing that scales with you</h2>
            <p className="mx-auto max-w-3xl text-xl text-blue-100">
              No setup fees, no monthly subscriptions, no hidden costs. You only pay when you get paid.
            </p>
          </div>
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm md:p-12">
              <div className="mb-8 text-center">
                <div className="mb-4 text-5xl font-bold md:text-6xl">
                  <span className="text-blue-300">1.5%</span> + <span className="text-green-300">$0.50</span>
                </div>
                <div className="mb-2 text-xl text-blue-100">per successful payment</div>
                <div className="text-lg text-blue-200">Maximum fee: $15 per transaction</div>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-2xl font-semibold text-blue-100">What's included</h3>
                  <ul className="space-y-3">
                    <FeatureListItem>Unlimited invoice creation</FeatureListItem>
                    <FeatureListItem>Global payment processing</FeatureListItem>
                    <FeatureListItem>Real-time payment tracking</FeatureListItem>
                    <FeatureListItem>Multi-currency support</FeatureListItem>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-4 text-2xl font-semibold text-blue-100">Example costs</h3>
                  <div className="space-y-3">
                    <PricingExample amount="$100 payment" cost="$2.00" />
                    <PricingExample amount="$500 payment" cost="$8.00" />
                    <PricingExample amount="$1,000+ payment" cost="$15.00 max" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Final CTA */}
        <Section className="bg-blue-600 py-16 text-white">
          <div className="text-center">
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">Start getting paid the easy way</h2>
            <p className="mb-8 text-xl opacity-90">Join thousands of contractors and companies already using Flexile</p>
            <Button size="default" className="bg-white px-8 py-3 text-lg text-blue-600 hover:bg-gray-100" asChild>
              <Link href="/signup">
                Sign up free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </Section>

        {/* Footer */}
        <Section className="bg-black py-12 text-white">
          <div className="flex flex-col items-start justify-between md:flex-row md:items-center">
            <div className="mb-8 md:mb-0">
              <Image src={logo} alt="Flexile" className="mb-4 h-8 w-auto invert" />
              <p className="max-w-md text-gray-400">
                Open source contractor payments platform. Simplifying payments for the modern workforce.
              </p>
            </div>
            <div className="flex flex-col gap-6 md:flex-row">
              <Link href="/privacy" className="text-gray-300 transition-colors hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-300 transition-colors hover:text-white">
                Terms of Service
              </Link>
              <a
                href="https://github.com/antiwork/flexile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 transition-colors hover:text-white"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Flexile. Open source under MIT License.</p>
          </div>
        </Section>
      </main>
    </>
  );
}

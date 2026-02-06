import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContributor } from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardFaq } from "@/components/dashboard/help/dashboard-faq";
import { ContactForm } from "@/components/dashboard/help/contact-form";
import { FeedbackForm } from "@/components/dashboard/help/feedback-form";
import { Glossary } from "@/components/dashboard/help/glossary";

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const contributor = await getContributor(user.id);
  if (!contributor) redirect("/onboarding");

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Help & Support"
        description="Find answers, get help, or share feedback."
      />

      <div className="grid gap-6">
        <DashboardFaq />

        <div className="grid sm:grid-cols-2 gap-6">
          <ContactForm
            userName={contributor.display_name || contributor.full_name}
            userEmail={contributor.email}
          />
          <div className="space-y-6">
            <FeedbackForm />
            <Glossary />
          </div>
        </div>
      </div>
    </div>
  );
}

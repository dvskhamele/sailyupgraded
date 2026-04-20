// app/[locale]/(routes)/profile/page.tsx
import { Suspense } from "react";
import { getUser } from "@/actions/get-user";
import { getTranslations } from "next-intl/server";

import Container from "../components/ui/Container";
import { ProfileHero } from "./components/ProfileHero";
import { ProfileTabs } from "./components/ProfileTabs";
import { ProfileTabContent } from "./components/tabs/ProfileTabContent";
import { PreferencesTabContent } from "./components/tabs/PreferencesTabContent";
import { AdministrationTabContent } from "./components/tabs/AdministrationTabContent";
// import { SecurityTabContent } from "./components/tabs/SecurityTabContent";
// import { DeveloperTabContent } from "./components/tabs/DeveloperTabContent";
// import { EmailAccountsTabContent } from "./components/tabs/EmailAccountsTabContent";
// import { LlmsTabContent } from "./components/tabs/LlmsTabContent";
// import { getUserApiKeys } from "./actions/api-keys";

const ProfilePage = async () => {
  const t = await getTranslations("ProfilePage");
  const data = await getUser();

  if (!data) {
    return <div>No user data.</div>;
  }

  // const llmKeys = await getUserApiKeys();

  return (
    <Container title={t("title")} description={t("description")}>
      <div className="rounded-lg border border-border overflow-hidden">
        <ProfileHero data={data} />
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
          <ProfileTabs
            profileContent={<ProfileTabContent data={data} />}
            preferencesContent={<PreferencesTabContent userId={data.id} />}
            administrationContent={
              data.role === "admin" ? <AdministrationTabContent /> : undefined
            }
            isAdmin={data.role === "admin"}
            // securityContent={<SecurityTabContent userId={data.id} />}
            // developerContent={<DeveloperTabContent userId={data.id} />}
            // emailsContent={<EmailAccountsTabContent />}
            // llmsContent={<LlmsTabContent initialKeys={llmKeys} />}
          />
        </Suspense>
      </div>
    </Container>
  );
};

export default ProfilePage;

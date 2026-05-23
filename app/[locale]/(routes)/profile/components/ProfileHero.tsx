// app/[locale]/(routes)/profile/components/ProfileHero.tsx
import { Users } from "@prisma/client";
import { ProfileHeroAvatar } from "./ProfileHeroAvatar";
import { EmailLink } from "@/components/ui/contact-link";

type Props = {
  data: Users;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

function getRoleLabel(role?: string | null) {
  const normalizedRole = role?.trim().toLowerCase() || "member";
  return ROLE_LABELS[normalizedRole] ?? normalizedRole;
}

export function ProfileHero({ data }: Props) {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-violet-600 px-7 py-6 flex items-center gap-4">
      <ProfileHeroAvatar avatar={data.avatar} name={data.name} />
      <div>
        <div className="text-white text-lg font-bold leading-tight">
          {data.name}
        </div>
        <div className="text-white/75 text-sm">
          <EmailLink value={data.email} className="text-white/75 hover:text-white" />
        </div>
        <span className="mt-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
          {getRoleLabel(data.role)}
        </span>
      </div>
    </div>
  );
}

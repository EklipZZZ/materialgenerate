export interface FilingProfile {
  applicant_address: string;
  postal_code: string;
  contact_name: string;
  contact_phone: string;
}

export const EMPTY_FILING_PROFILE: FilingProfile = {
  applicant_address: "",
  postal_code: "",
  contact_name: "",
  contact_phone: "",
};

export function isFilingProfileComplete(profile: FilingProfile | null | undefined): profile is FilingProfile {
  return Boolean(profile
    && profile.applicant_address.trim()
    && profile.postal_code.trim()
    && profile.contact_name.trim()
    && profile.contact_phone.trim());
}

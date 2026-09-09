export interface AddressDto {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface InstitutionRegistrationDto {
  institutionCode: string;
  institutionName: string;
  shortName: string;
  institutionType: 'UNIVERSITY' | 'COLLEGE' | 'AUTONOMOUS' | 'DEEMED';
  institutionCategory: 'ENGINEERING' | 'MANAGEMENT' | 'GENERAL' | 'MULTI_DISCIPLINARY';
  universityName: string;
  universityCode?: string;
  aicteCode?: string;
  nbaAccredited?: boolean;
  naacGrade?: string;
  establishmentYear?: number;
  principalName?: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  website?: string;
  logoUrl?: string;
  address: AddressDto;
  status: 'ACTIVE' | 'INACTIVE';
}
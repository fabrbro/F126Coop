// Typed API client for the F1CoopSim backend.

export type Session = "RACE" | "SPRINT";
export type RaceStatus = "UPCOMING" | "COMPLETED";

export interface AuthUser {
  id: string;
  name: string;
  avatarUrl: string;
  isAdmin: boolean;
}
export type ClaimUser = AuthUser;

export interface Driver {
  id: string;
  name: string;
  code: string;
  number: number;
  imageUrl: string | null;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  fullName: string;
  color: string;
  order: number;
  drivers: Driver[];
}

export interface Entrant {
  id: string;
  careerId: string;
  teamId: string;
  name: string;
  code: string;
  number: number;
  isPlayer: boolean;
  replacedDriver: string | null;
  imageUrl: string | null;
  nationality: string | null;
  order: number;
  team: Team;
  claimedById: string | null;
  claimedBy: ClaimUser | null;
}

export interface Result {
  id: string;
  raceId: string;
  entrantId: string;
  session: Session;
  position: number | null;
  dnf: boolean;
  points: number;
}

export interface Race {
  id: string;
  careerId: string;
  round: number;
  name: string;
  country: string;
  circuit: string | null;
  date: string | null;
  isSprint: boolean;
  status: RaceStatus;
  results: Result[];
  driverOfDayId: string | null;
  mostOvertakesId: string | null;
  cleanestId: string | null;
  fastestLapId: string | null;
}

// Keys of the four non-scoring race awards.
export type AwardKey = "driverOfDayId" | "mostOvertakesId" | "cleanestId" | "fastestLapId";

export interface Career {
  id: string;
  slug: string | null;
  name: string;
  seasonYear: number;
  createdAt: string;
  updatedAt: string;
  entrants: Entrant[];
  races: Race[];
}

export interface DriverStanding {
  entrantId: string;
  name: string;
  code: string;
  number: number;
  isPlayer: boolean;
  imageUrl: string | null;
  nationality: string | null;
  teamId: string;
  teamName: string;
  teamColor: string;
  points: number;
  wins: number;
  podiums: number;
  claimedBy: ClaimUser | null;
}

export interface ConstructorStanding {
  teamId: string;
  teamName: string;
  teamColor: string;
  points: number;
  wins: number;
}

export interface Standings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface CareerSummary {
  id: string;
  slug: string | null;
  name: string;
  seasonYear: number;
  createdAt: string;
  updatedAt: string;
  driverCount: number;
  totalRaces: number;
  completedRaces: number;
}

export interface CareerDetail {
  career: Career;
  standings: Standings;
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface EntrantInput {
  teamId: string;
  name: string;
  code: string;
  number: number;
  isPlayer: boolean;
  replacedDriver: string | null;
  imageUrl: string | null;
  nationality: string | null;
}

export interface ResultRowInput {
  entrantId: string;
  position: number | null;
  dnf: boolean;
}

export const api = {
  getAuthStatus: () => req<{ enabled: boolean }>("/api/auth/status"),
  getMe: () => req<{ user: AuthUser | null }>("/api/auth/me"),
  logout: () => req<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  claimDriver: (careerId: string, entrantId: string) =>
    req<{ ok: true }>(`/api/careers/${careerId}/entrants/${entrantId}/claim`, { method: "POST" }),
  unclaimDriver: (careerId: string, entrantId: string) =>
    req<{ ok: true }>(`/api/careers/${careerId}/entrants/${entrantId}/claim`, { method: "DELETE" }),
  listUsers: () => req<{ users: ClaimUser[] }>("/api/users"),
  assignDriver: (careerId: string, entrantId: string, userId: string | null) =>
    req<{ ok: true }>(`/api/careers/${careerId}/entrants/${entrantId}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  getRoster: () => req<{ teams: Team[] }>("/api/roster"),

  listCareers: () => req<{ careers: CareerSummary[] }>("/api/careers"),

  createCareer: (data: { name: string; seasonYear?: number; entrants: EntrantInput[] }) =>
    req<{ id: string; slug: string | null }>("/api/careers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCareer: (id: string) => req<CareerDetail>(`/api/careers/${id}`),

  renameCareer: (id: string, name: string) =>
    req<{ ok: true }>(`/api/careers/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),

  deleteCareer: (id: string) => req<{ ok: true }>(`/api/careers/${id}`, { method: "DELETE" }),

  editRace: (
    careerId: string,
    raceId: string,
    data: Partial<
      Pick<
        Race,
        | "name"
        | "country"
        | "circuit"
        | "date"
        | "isSprint"
        | "driverOfDayId"
        | "mostOvertakesId"
        | "cleanestId"
        | "fastestLapId"
      >
    >
  ) =>
    req<{ race: Race }>(`/api/careers/${careerId}/races/${raceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateEntrant: (
    careerId: string,
    entrantId: string,
    data: Partial<{
      name: string;
      code: string;
      number: number;
      isPlayer: boolean;
      imageUrl: string | null;
      replacedDriver: string | null;
      nationality: string | null;
    }>
  ) =>
    req<{ entrant: Entrant }>(`/api/careers/${careerId}/entrants/${entrantId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  submitResults: (careerId: string, raceId: string, session: Session, results: ResultRowInput[]) =>
    req<{ race: Race; standings: Standings }>(
      `/api/careers/${careerId}/races/${raceId}/results`,
      { method: "PUT", body: JSON.stringify({ session, results }) }
    ),

  clearResults: (careerId: string, raceId: string, session: Session) =>
    req<{ ok: true; standings: Standings }>(
      `/api/careers/${careerId}/races/${raceId}/results?session=${session}`,
      { method: "DELETE" }
    ),
};


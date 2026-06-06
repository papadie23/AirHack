/** Mock authentication data for AirHack demo */

export interface ClientCredential {
  phone: string;
  flightIata: string;
  personId: string;
  displayName: string;
}

export const MOCK_CLIENTS: ClientCredential[] = [
  { phone: "+40721000001", flightIata: "RO321",  personId: "misu",   displayName: "Mihai Popescu"   },
  { phone: "+40721000002", flightIata: "LH1407", personId: "ionica", displayName: "Ioana Constantin" },
  { phone: "+40721000003", flightIata: "FR8821", personId: "dorel",  displayName: "Dorel Ionescu"   },
  { phone: "+40721000004", flightIata: "W64102", personId: "misu",   displayName: "Andrei Marin"    },
  { phone: "+40721000005", flightIata: "AF1234", personId: "ionica", displayName: "Elena Dumitrescu" },
];

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin";

/** Normalise IATA: remove spaces, uppercase */
function normaliseIata(s: string) {
  return s.replace(/\s/g, "").toUpperCase();
}

export function findClient(phone: string, flightIata: string): ClientCredential | null {
  const normIata = normaliseIata(flightIata);
  return (
    MOCK_CLIENTS.find(
      c => c.phone === phone.trim() && normaliseIata(c.flightIata) === normIata,
    ) ?? null
  );
}

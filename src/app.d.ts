declare global {
	namespace App {
		interface Locals {
			admin:
				| {
						role: 'admin';
				  }
				| null;
		}

		interface Platform {
			env?: {
				JWT_SECRET?: string;
			};
		}
	}
}

export {};

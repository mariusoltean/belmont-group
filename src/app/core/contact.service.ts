import { Injectable } from '@angular/core';

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

/**
 * The single place to wire the contact form to a backend.
 *
 * STUB — there is no backend yet (open item with the client). `send()` resolves
 * without delivering anything. Replace the body with the real call once an
 * endpoint exists; reject the promise on failure so the form shows its error line.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  send(_message: ContactMessage): Promise<void> {
    // TODO(backend): deliver the message. Do not invent an endpoint here.
    return Promise.resolve();
  }
}

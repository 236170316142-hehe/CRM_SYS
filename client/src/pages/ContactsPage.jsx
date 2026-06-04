import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { Mail, Phone, Building2, X } from 'lucide-react';

export default function ContactsPage() {
  const [selectedContact, setSelectedContact] = useState(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await api.get('/contacts');
      return res.data;
    },
  });

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 transition-all ${selectedContact ? 'hidden lg:block' : 'block'}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your people and relationships</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Tickets</th>
                <th className="px-6 py-4">Assigned Rep</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading contacts...</td>
                </tr>
              ) : contacts?.map((contact) => (
                <tr 
                  key={contact._id} 
                  onClick={() => setSelectedContact(contact)}
                  className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors ${selectedContact?._id === contact._id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{contact.name}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" /> {contact.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {contact.company || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {contact.openTicketCount > 0 ? (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                        {contact.openTicketCount} Open
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    {contact.assignedTo?.name || 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel */}
      {selectedContact && (
        <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 relative">
            <button 
              onClick={() => setSelectedContact(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg">
              {selectedContact.name.charAt(0)}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedContact.name}</h2>
            <p className="text-slate-500 flex items-center gap-2 mt-2 text-sm">
              <Building2 className="w-4 h-4" /> {selectedContact.company || 'No Company'}
            </p>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <a href={`mailto:${selectedContact.email}`} className="hover:text-blue-600 transition-colors">{selectedContact.email}</a>
                </div>
                {selectedContact.phone && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <a href={`tel:${selectedContact.phone}`} className="hover:text-blue-600 transition-colors">{selectedContact.phone}</a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Support</h3>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-sm text-slate-500 mb-1">Open Tickets</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{selectedContact.openTicketCount}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

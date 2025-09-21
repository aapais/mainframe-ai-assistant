#!/usr/bin/env python3
"""
Accenture Mainframe AI Assistant - Standalone Desktop Application
No browser needed - runs as a native Python application
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import sqlite3
import json
from datetime import datetime
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import webbrowser

class DatabaseManager:
    def __init__(self):
        self.db_path = 'kb-assistant.db'

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def search_incidents(self, query):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            search_term = f'%{query}%'
            cursor.execute("""
                SELECT * FROM entries
                WHERE title LIKE ? OR description LIKE ?
                   OR category LIKE ? OR solution LIKE ?
                ORDER BY created_at DESC
                LIMIT 100
            """, (search_term, search_term, search_term, search_term))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_incidents(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM entries ORDER BY created_at DESC LIMIT 100")
            return [dict(row) for row in cursor.fetchall()]

    def add_incident(self, data):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO entries (
                    title, description, category, severity,
                    status, priority, reporter, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                data['title'], data['description'], data['category'],
                data['severity'], data.get('status', 'aberto'),
                data.get('priority', 'P3'), data['reporter']
            ))
            conn.commit()
            return cursor.lastrowid

class MainframeAssistantApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Accenture Mainframe AI Assistant")
        self.root.geometry("1200x700")

        # Database
        self.db = DatabaseManager()

        # Accenture colors
        self.colors = {
            'purple': '#A100FF',
            'black': '#000000',
            'white': '#FFFFFF',
            'gray': '#F5F5F5'
        }

        self.setup_ui()
        self.load_incidents()

    def setup_ui(self):
        # Header
        header_frame = tk.Frame(self.root, bg=self.colors['purple'], height=60)
        header_frame.pack(fill=tk.X)
        header_frame.pack_propagate(False)

        title_label = tk.Label(
            header_frame,
            text="🏢 Accenture Mainframe AI Assistant",
            bg=self.colors['purple'],
            fg=self.colors['white'],
            font=('Arial', 18, 'bold')
        )
        title_label.pack(pady=15)

        # Search Frame
        search_frame = tk.Frame(self.root, bg=self.colors['gray'], pady=10)
        search_frame.pack(fill=tk.X)

        tk.Label(search_frame, text="Search:", bg=self.colors['gray'], font=('Arial', 12)).pack(side=tk.LEFT, padx=10)

        self.search_entry = tk.Entry(search_frame, font=('Arial', 12), width=50)
        self.search_entry.pack(side=tk.LEFT, padx=5)
        self.search_entry.bind('<Return>', lambda e: self.search_incidents())

        tk.Button(
            search_frame,
            text="🔍 Search",
            command=self.search_incidents,
            bg=self.colors['purple'],
            fg=self.colors['white'],
            font=('Arial', 11, 'bold')
        ).pack(side=tk.LEFT, padx=5)

        tk.Button(
            search_frame,
            text="➕ New Incident",
            command=self.show_new_incident_dialog,
            bg='#00A859',
            fg=self.colors['white'],
            font=('Arial', 11, 'bold')
        ).pack(side=tk.LEFT, padx=5)

        tk.Button(
            search_frame,
            text="🔄 Refresh",
            command=self.load_incidents,
            font=('Arial', 11)
        ).pack(side=tk.LEFT, padx=5)

        # Main Content
        content_frame = tk.Frame(self.root)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Incidents List (Left)
        list_frame = tk.Frame(content_frame)
        list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        tk.Label(list_frame, text="Incidents", font=('Arial', 14, 'bold')).pack()

        # Treeview for incidents
        columns = ('ID', 'Title', 'Category', 'Severity', 'Status')
        self.tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=20)

        # Define headings
        self.tree.heading('ID', text='ID')
        self.tree.heading('Title', text='Title')
        self.tree.heading('Category', text='Category')
        self.tree.heading('Severity', text='Severity')
        self.tree.heading('Status', text='Status')

        # Column widths
        self.tree.column('ID', width=50)
        self.tree.column('Title', width=300)
        self.tree.column('Category', width=100)
        self.tree.column('Severity', width=80)
        self.tree.column('Status', width=100)

        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Bind selection event
        self.tree.bind('<<TreeviewSelect>>', self.on_select_incident)

        # Details Panel (Right)
        details_frame = tk.Frame(content_frame, width=400)
        details_frame.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        details_frame.pack_propagate(False)

        tk.Label(details_frame, text="Details", font=('Arial', 14, 'bold')).pack()

        self.details_text = scrolledtext.ScrolledText(
            details_frame,
            wrap=tk.WORD,
            font=('Courier', 10),
            height=25
        )
        self.details_text.pack(fill=tk.BOTH, expand=True)

        # Status Bar
        status_frame = tk.Frame(self.root, bg=self.colors['gray'], height=30)
        status_frame.pack(fill=tk.X)
        status_frame.pack_propagate(False)

        self.status_label = tk.Label(
            status_frame,
            text="Ready",
            bg=self.colors['gray'],
            anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, padx=10, pady=5)

    def load_incidents(self):
        """Load all incidents from database"""
        self.tree.delete(*self.tree.get_children())
        incidents = self.db.get_all_incidents()

        for incident in incidents:
            self.tree.insert('', tk.END, values=(
                incident.get('id', ''),
                incident.get('title', ''),
                incident.get('category', ''),
                incident.get('severity', ''),
                incident.get('status', '')
            ))

        self.status_label.config(text=f"Loaded {len(incidents)} incidents")

    def search_incidents(self):
        """Search incidents"""
        query = self.search_entry.get()
        if not query:
            self.load_incidents()
            return

        self.tree.delete(*self.tree.get_children())
        incidents = self.db.search_incidents(query)

        for incident in incidents:
            self.tree.insert('', tk.END, values=(
                incident.get('id', ''),
                incident.get('title', ''),
                incident.get('category', ''),
                incident.get('severity', ''),
                incident.get('status', '')
            ))

        self.status_label.config(text=f"Found {len(incidents)} incidents matching '{query}'")

    def on_select_incident(self, event):
        """Show incident details when selected"""
        selection = self.tree.selection()
        if not selection:
            return

        item = self.tree.item(selection[0])
        incident_id = item['values'][0]

        # Get full incident details
        incidents = self.db.get_all_incidents()
        incident = next((i for i in incidents if i.get('id') == incident_id), None)

        if incident:
            self.details_text.delete(1.0, tk.END)
            details = f"""
ID: {incident.get('id', 'N/A')}
Title: {incident.get('title', 'N/A')}
Category: {incident.get('category', 'N/A')}
Severity: {incident.get('severity', 'N/A')}
Status: {incident.get('status', 'N/A')}
Priority: {incident.get('priority', 'N/A')}
Reporter: {incident.get('reporter', 'N/A')}
Created: {incident.get('created_at', 'N/A')}
Updated: {incident.get('updated_at', 'N/A')}

Description:
{incident.get('description', 'N/A')}

Solution:
{incident.get('solution', 'No solution available')}
"""
            self.details_text.insert(1.0, details)

    def show_new_incident_dialog(self):
        """Show dialog to create new incident"""
        dialog = tk.Toplevel(self.root)
        dialog.title("New Incident")
        dialog.geometry("500x500")

        # Form fields
        fields = {}

        tk.Label(dialog, text="Title:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        fields['title'] = tk.Entry(dialog, width=50)
        fields['title'].grid(row=0, column=1, padx=10, pady=5)

        tk.Label(dialog, text="Description:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        fields['description'] = tk.Text(dialog, width=50, height=5)
        fields['description'].grid(row=1, column=1, padx=10, pady=5)

        tk.Label(dialog, text="Category:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        fields['category'] = ttk.Combobox(dialog, values=['COBOL', 'JCL', 'DB2', 'CICS', 'VSAM'], width=47)
        fields['category'].grid(row=2, column=1, padx=10, pady=5)

        tk.Label(dialog, text="Severity:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        fields['severity'] = ttk.Combobox(dialog, values=['low', 'medium', 'high', 'critical'], width=47)
        fields['severity'].grid(row=3, column=1, padx=10, pady=5)

        tk.Label(dialog, text="Priority:").grid(row=4, column=0, sticky=tk.W, padx=10, pady=5)
        fields['priority'] = ttk.Combobox(dialog, values=['P1', 'P2', 'P3', 'P4'], width=47)
        fields['priority'].grid(row=4, column=1, padx=10, pady=5)

        tk.Label(dialog, text="Reporter:").grid(row=5, column=0, sticky=tk.W, padx=10, pady=5)
        fields['reporter'] = tk.Entry(dialog, width=50)
        fields['reporter'].grid(row=5, column=1, padx=10, pady=5)

        # Buttons
        def save_incident():
            data = {
                'title': fields['title'].get(),
                'description': fields['description'].get(1.0, tk.END).strip(),
                'category': fields['category'].get(),
                'severity': fields['severity'].get(),
                'priority': fields['priority'].get(),
                'reporter': fields['reporter'].get()
            }

            if not all([data['title'], data['description'], data['category'], data['severity'], data['reporter']]):
                messagebox.showwarning("Incomplete", "Please fill all required fields")
                return

            self.db.add_incident(data)
            self.load_incidents()
            dialog.destroy()
            messagebox.showinfo("Success", "Incident created successfully")

        tk.Button(
            dialog,
            text="Save",
            command=save_incident,
            bg=self.colors['purple'],
            fg=self.colors['white']
        ).grid(row=6, column=1, pady=20)

def main():
    root = tk.Tk()
    app = MainframeAssistantApp(root)
    root.mainloop()

if __name__ == '__main__':
    main()
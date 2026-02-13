"""
Backend i18n module specifically for email notifications.
This module provides translation templates for emails sent by Celery workers,
as they cannot use the frontend's dynamic translation system.
"""
import json
from app.core.config import settings

# Email templates organized by notification type
# Markers like {parameter} will be used for Python .format() interpolation
TRANSLATIONS = {
    "en": {
        "notifications": {
            "comment_added": {
                "title": "New Comment on Your Report",
                "message": "{commenter_name} commented on report '{report_title}'."
            },
            "report_created": {
                "title": "New Report Submitted",
                "message": "Hacker {hacker_name} submitted a new report to your organization."
            },
            "status_changed": {
                "title": "Report Status Updated",
                "message": "The status of your report has changed from {old_status} to {new_status}."
            },
            "severity_changed": {
                "title": "Report Severity Updated",
                "message": "The severity of your report has changed from {old_severity} to {new_severity}."
            }
        }
    },
    "es": {
        "notifications": {
            "comment_added": {
                "title": "Nuevo comentario en tu reporte",
                "message": "{commenter_name} comentó en el reporte '{report_title}'."
            },
            "report_created": {
                "title": "Nuevo reporte enviado",
                "message": "El hacker {hacker_name} envió un nuevo reporte a tu organización."
            },
            "status_changed": {
                "title": "Estado del reporte actualizado",
                "message": "El estado de tu reporte ha cambiado de {old_status} a {new_status}."
            },
            "severity_changed": {
                "title": "Severidad del reporte actualizada",
                "message": "La severidad de tu reporte ha cambiado de {old_severity} a {new_severity}."
            }
        }
    }
}

# Value translations for status and severity to be used in email templates
VALUE_TRANSLATIONS = {
    "en": {
        "status": {
            "received": "Received",
            "in_review": "In Review",
            "accepted": "Accepted",
            "rejected": "Rejected",
            "duplicate": "Duplicate",
            "out_of_scope": "Out of Scope",
            "resolved": "Resolved"
        },
        "severity": {
            "none": "None",
            "low": "Low",
            "medium": "Medium",
            "high": "High",
            "critical": "Critical",
            "unknown": "Unknown"
        }
    },
    "es": {
        "status": {
            "received": "Recibido",
            "in_review": "En Revisión",
            "accepted": "Aceptado",
            "rejected": "Rechazado",
            "duplicate": "Duplicado",
            "out_of_scope": "Fuera de Alcance",
            "resolved": "Resuelto"
        },
        "severity": {
            "none": "Ninguna",
            "low": "Baja",
            "medium": "Media",
            "high": "Alta",
            "critical": "Crítica",
            "unknown": "Desconocida"
        }
    }
}

def get_severity_category(severity_val) -> str:
    """Helper to convert numeric severity to category string key"""
    try:
        val = float(severity_val)
        if val == 0.0: return "none"
        if 0.1 <= val <= 3.9: return "low"
        if 4.0 <= val <= 6.9: return "medium"
        if 7.0 <= val <= 8.9: return "high"
        if 9.0 <= val <= 10.0: return "critical"
        return "unknown"
    except (ValueError, TypeError):
        return str(severity_val).lower()


def translate_for_email(notif_type: str, field: str, params: dict = None, lang: str = None) -> str:
    """
    Translates a specific field (title or message) for a given notification type 
    specifically for EMAIL rendering.
    
    Args:
        notif_type: The notification type (e.g., 'comment_added')
        field: The field to translate ('title' or 'message')
        params: Dictionary of parameters for interpolation
        lang: Language code (defaults to settings.VITE_DEFAULT_LANGUAGE)
    """
    if lang is None:
        lang = settings.VITE_DEFAULT_LANGUAGE
    
    # Simple language normalization (e.g., 'es-ES' -> 'es')
    lang_key = lang.lower()[:2]
    
    # Fallback to English
    lang_data = TRANSLATIONS.get(lang_key, TRANSLATIONS["en"])
    notif_data = lang_data.get("notifications", {}).get(notif_type, {})
    
    template = notif_data.get(field)
    
    # Fallback if specific type or field is missing
    if not template:
        # Check in English if not English
        if lang_key != "en":
            template = TRANSLATIONS["en"].get("notifications", {}).get(notif_type, {}).get(field)
        
        # Final fallback to raw string if still missing
        if not template:
            return f"{notif_type}.{field}"

    if params:
        # Create a copy to avoid mutating the original dict if it's reused elsewhere
        safe_params = params.copy()
        
        # Helper to translate a value if it exists in the maps
        def _translate_param(param_key: str, category: str):
            if param_key in safe_params:
                raw_val = safe_params[param_key]
                
                # Special handling for severity which might be a float/number
                lookup_key = str(raw_val).lower()
                if category == 'severity':
                    lookup_key = get_severity_category(raw_val)
                
                # Attempt translation
                trans_map = VALUE_TRANSLATIONS.get(lang_key, VALUE_TRANSLATIONS["en"]).get(category, {})
                translated_val = trans_map.get(lookup_key)
                
                if translated_val:
                    if category == 'severity':
                         # Append the score to the translated severity category
                        try:
                            score = float(raw_val)
                            safe_params[param_key] = f"{translated_val} ({score:.1f})"
                        except (ValueError, TypeError):
                            safe_params[param_key] = translated_val
                    else:
                        safe_params[param_key] = translated_val

        # Apply translations to known status/severity fields
        _translate_param('old_status', 'status')
        _translate_param('new_status', 'status')
        _translate_param('old_severity', 'severity')
        _translate_param('new_severity', 'severity')

        try:
            return template.format(**safe_params)
        except (KeyError, ValueError, AttributeError) as e:
            # If interpolation fails, return the safe message
            return template
            
    return template

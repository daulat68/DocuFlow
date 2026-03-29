import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
import os
import time  # Changed from datetime for cleaner timestamp handling
from typing import Optional

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "your_cloud_name"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "your_api_key"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "your_api_secret"),
    secure=True
)

async def upload_to_cloudinary(file_content: bytes, filename: str, folder: str = "documents") -> dict:
    """Upload file to Cloudinary and return signed URL for processing"""
    try:
        name_without_ext = os.path.splitext(filename)[0]
        
        result = cloudinary.uploader.upload(
            file_content,
            public_id=name_without_ext,
            folder=folder,
            resource_type="raw",  # Changed "auto" to "raw" for reliable PDF handling
            type="upload",        
            access_mode="public", # Ensure it's accessible for the download request
            overwrite=True,
            invalidate=True
        )
        
        # FIX: Changed type to "upload" and used expires_at for the timestamp
        signed_url = cloudinary.utils.cloudinary_url(
            result["public_id"],
            sign_url=True,
            type="upload",        # Must match the upload type above
            resource_type="raw",  # Must match the upload resource_type
            expires_at=int(time.time() + 86400) # 24 hours from now
        )[0]
        
        return {
            "url": result["secure_url"],
            "download_url": signed_url,
            "public_id": result["public_id"],
            "size": result["bytes"],
            "type": result["resource_type"]
        }
    except Exception as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")

def get_signed_download_url(public_id: str, resource_type: str = "raw") -> str:
    """Generate a signed URL for downloading a file from Cloudinary"""
    try:
        # FIX: Changed type to "upload" to match the storage bucket
        signed_url = cloudinary.utils.cloudinary_url(
            public_id,
            sign_url=True,
            type="upload",
            resource_type=resource_type,
            expires_at=int(time.time() + 86400)
        )[0]
        return signed_url
    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")

def delete_from_cloudinary(public_id: str) -> bool:
    """Delete file from Cloudinary"""
    try:
        # Use resource_type="raw" for PDFs
        cloudinary.uploader.destroy(public_id, resource_type="raw")
        return True
    except Exception as e:
        print(f"Cloudinary delete failed: {str(e)}")
        return False

def get_file_from_cloudinary_url(url: str) -> str:
    return url
# OCR Setup Guide for Media Library

The Media Library system now supports Optical Character Recognition (OCR) for extracting text from image-based PDFs and image files. This guide explains how to configure OCR capabilities.

## 🎯 What OCR Enables

- **Image-based PDFs**: Extract text from scanned documents, image-heavy PDFs
- **Direct Image Files**: Process JPG, PNG, GIF, BMP, TIFF files for text content
- **Enhanced Document Processing**: Fallback to OCR when standard text extraction fails
- **Multi-language Support**: Configurable language detection

## 🔧 OCR Service Configuration

### Option 1: OCR.Space API (Free Tier Available)

1. **Get API Key**:
   - Visit [OCR.Space](https://ocr.space/ocrapi)
   - Sign up for free account (500 requests/month)
   - Get your API key

2. **Configure Supabase**:
   ```bash
   # Add to Supabase Edge Function secrets
   supabase secrets set OCR_SPACE_API_KEY=your_api_key_here
   ```

3. **Verify Setup**:
   - Upload an image-based PDF or image file
   - Click "Reprocess" in Media tab
   - Check logs for OCR processing messages

### Option 2: Alternative OCR Services

The system is designed to easily support other OCR providers:

- **Google Vision API**: High accuracy, supports many languages
- **Azure Computer Vision**: Microsoft's OCR service
- **AWS Textract**: Amazon's document analysis service
- **Tesseract**: Open-source OCR engine

## 📊 Processing Flow

### For PDFs:
1. **Standard Text Extraction**: Attempts multiple PDF text extraction strategies
2. **OCR Fallback**: If <20 characters extracted, attempts OCR processing
3. **Combined Results**: Uses best result from either method

### For Images:
1. **Direct OCR**: Immediately processes image files with OCR
2. **Format Support**: JPEG, PNG, GIF, BMP, TIFF
3. **Quality Optimization**: Automatic orientation detection and scaling

## 🔍 Monitoring & Troubleshooting

### Check OCR Status:
```sql
-- View documents with OCR processing
SELECT 
  file_name, 
  file_type,
  processing_status,
  LENGTH(text_content) as text_length,
  chunk_count,
  CASE 
    WHEN text_content LIKE '%OCR processing%' THEN 'OCR_ATTEMPTED'
    WHEN text_content LIKE '%complex PDF format%' THEN 'COMPLEX_PDF'
    ELSE 'STANDARD_EXTRACTION'
  END as extraction_method
FROM media_library 
WHERE file_type IN ('application/pdf', 'image/jpeg', 'image/png')
ORDER BY created_at DESC;
```

### Common Issues:

1. **"OCR service unavailable"**: API key not configured
2. **"OCR processing failed"**: Check API quota/connectivity
3. **Low quality results**: Image resolution too low for OCR
4. **No text detected"**: Image may not contain readable text

## 🚀 Usage Examples

### Image-based PDF Processing:
```
1. Upload scanned PDF document
2. System attempts standard text extraction
3. If minimal text found, automatically tries OCR
4. Results combined for best text extraction
```

### Direct Image Processing:
```
1. Upload JPG/PNG image with text
2. System immediately processes with OCR
3. Extracted text stored and chunked
4. Available to agents via MCP tools
```

## 💡 Best Practices

### For Optimal OCR Results:
- **High Resolution**: 300+ DPI for scanned documents
- **Good Contrast**: Dark text on light background
- **Proper Orientation**: Upright text orientation
- **Clean Images**: Minimal noise, clear text

### Performance Considerations:
- **File Size Limits**: Large files may timeout during OCR
- **API Quotas**: Monitor usage against service limits
- **Processing Time**: OCR takes longer than text extraction
- **Cost Management**: Track API usage for billing

## 🔒 Security & Privacy

- **API Keys**: Stored securely in Supabase Vault
- **Data Transmission**: Files sent to OCR service temporarily
- **No Storage**: OCR services don't permanently store documents
- **Privacy Policy**: Review OCR provider's privacy terms

## 📈 Future Enhancements

Planned improvements:
- **Local OCR**: Tesseract integration for on-premise processing
- **Batch Processing**: Multiple document OCR optimization
- **Language Detection**: Automatic language identification
- **Quality Assessment**: OCR confidence scoring
- **Custom Models**: Domain-specific OCR training

## 🆘 Support

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Verify API key configuration
3. Test with simple, high-quality images first
4. Monitor API quota usage
5. Review OCR service documentation

---

*This OCR system transforms the Media Library from text-only document processing into a comprehensive document intelligence platform capable of handling any document format.*

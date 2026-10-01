from PIL import Image, ImageDraw

def create_icon(size, filename, text):
    img = Image.new('RGB', (size, size), color = '#4A3728')
    d = ImageDraw.Draw(img)
    # Just a simple text representation if we can't load a font
    d.rectangle([size//4, size//4, size*3//4, size*3//4], fill='#FDFBF7')
    img.save(filename)

create_icon(192, 'frontend/public/pwa-192x192.png', 'SmartHOA')
create_icon(512, 'frontend/public/pwa-512x512.png', 'SmartHOA')
print("Icons generated successfully.")

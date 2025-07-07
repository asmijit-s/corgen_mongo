// CustomImage.js
import { Image } from "@tiptap/extension-image";


const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 120,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => attributes.width ? { width: attributes.width } : {}
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => attributes.height ? { height: attributes.height } : {}
      },
      class: {
        default: '',
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => attributes.class ? { class: attributes.class } : {}
      },
      'data-storage-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-storage-id'),
        renderHTML: attributes => ({
          'data-storage-id': attributes['data-storage-id']
        })
      }
    };
  }
});
export default CustomImage;

function isYamlSayRedirect(cachedMetadata) {
	let frontMatter = cachedMetadata == null ? void 0 : cachedMetadata.frontmatter; // get yaml area
	let redirectInYaml = (frontMatter == null ? void 0 : frontMatter.redirect) || (frontMatter == null ? void 0 : frontMatter.redirects); // get attribute in yaml whose key is redirect(s)
	return redirectInYaml == true;
}

function isTagSayRedirect(cachedMetadata) {
	let tags = cachedMetadata == null ? void 0 : cachedMetadata.tags;
	if ( tags == null ) return false;
	for (let i=0; i< tags.length; i++) {
		let tag = tags[i];
		if ( tag.tag.toUpperCase() === "#REDIRECT" ) {
			return true;
		}
	}
	return false;
}

export function tryRedirect(fileToOpened, app) {
    let _a1;
    let _b;
    let _c;
    let _d;
    
    let cachedMetadata = (_a1 = app.metadataCache.getFileCache(fileToOpened)) == null ? void 0 : _a1;
	let isRedirect = isYamlSayRedirect(cachedMetadata) || isTagSayRedirect(cachedMetadata);
	if ( isRedirect ) {
		let firstLink = cachedMetadata == null ? void 0 : (_b = _a1.links) == null ? void 0 : _b.length <= 0 ? void 0 : (_c = _b[0]) == null ? void 0 : (_d = _c.link) == null ? void 0 : _d;
		let redirectFile = (firstLink == null ? void 0 : app.metadataCache.getFirstLinkpathDest(firstLink, fileToOpened.path));
        fileToOpened = (redirectFile == null ? fileToOpened : redirectFile); // overwrite file to open
	}
	
	return fileToOpened;
}

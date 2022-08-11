var el = wp.element.createElement,
        registerBlockType = wp.blocks.registerBlockType;

var blockStyle = {
    backgroundColor: 'transparent',
    color: '#444',
    fontSize: '18px',
    width: '100%',
    fontFamily: 'Noto Serif',
    border:'none',
    padding:'0',
};

wp.blocks.registerBlockType('ufm/strap-block', {
    title: 'Strap Line',
    icon: 'post-status',
    category: 'common',
    attributes: {
        content: {type: 'string'},
        color: {type: 'string'}
    },

    edit: function (props) {
        function updateContent(event) {
            props.setAttributes({content: event.target.value})
        }
        return React.createElement(
                "div",
                null,
                el("textarea", {style: blockStyle, rows: 2, cols: 100, value: props.attributes.content, onChange: updateContent})
                );
    },
    save: function (props) {
        return el(
                "p",
                {},
                props.attributes.content
                );
    }
})

